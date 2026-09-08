"""Moteur documentaire de COURRIER EA.

Le script remplace exclusivement les champs de fusion explicites au format
{{NOM_DU_CHAMP}}. Les styles, marges, en-têtes et le reste du contenu Word
ne sont jamais reconstruits.
"""

from __future__ import annotations

import argparse
import copy
import csv
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from collections import OrderedDict
from pathlib import Path
from typing import Iterator

from docx import Document
from docx.text.paragraph import Paragraph
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import RGBColor
from openpyxl import load_workbook
from pypdf import PdfReader, PdfWriter

FIELD_PATTERN = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")
RAW_FIELD_PATTERN = re.compile(r"\{\{[^{}]+\}\}")
REQUIRED_FIELD = "DESTINATAIRE"
PHONE_PATTERN = re.compile(r"^\+?[0-9][0-9 .()/-]{5,}$")


def iter_paragraphs(parent) -> Iterator[Paragraph]:
    """Yield regular paragraphs and paragraphs nested in all tables."""
    for paragraph in parent.paragraphs:
        yield paragraph
    for table in parent.tables:
        for row in table.rows:
            for cell in row.cells:
                yield from iter_paragraphs(cell)


def iter_document_paragraphs(document: Document) -> Iterator[Paragraph]:
    yield from iter_paragraphs(document)
    for section in document.sections:
        for area in (
            section.header,
            section.first_page_header,
            section.even_page_header,
            section.footer,
            section.first_page_footer,
            section.even_page_footer,
        ):
            yield from iter_paragraphs(area)


def inspect_fields(document: Document) -> tuple[list[str], dict[str, int], list[str]]:
    """Return ordered field names, occurrence counts and malformed fields."""
    counts: OrderedDict[str, int] = OrderedDict()
    malformed: list[str] = []
    for paragraph in iter_document_paragraphs(document):
        text = "".join(run.text for run in paragraph.runs)
        valid_spans = {(match.start(), match.end()) for match in FIELD_PATTERN.finditer(text)}
        for match in FIELD_PATTERN.finditer(text):
            field = match.group(1)
            counts[field] = counts.get(field, 0) + 1
        for raw_match in RAW_FIELD_PATTERN.finditer(text):
            if (raw_match.start(), raw_match.end()) not in valid_spans:
                malformed.append(raw_match.group(0))
    return list(counts.keys()), dict(counts), list(dict.fromkeys(malformed))


def _clone_run_with_text(source_run, text: str, *, black: bool = False):
    """Create a run beside source_run while preserving its Word formatting."""
    new_r = OxmlElement("w:r")
    if source_run._r.rPr is not None:
        new_r.append(copy.deepcopy(source_run._r.rPr))
    text_node = OxmlElement("w:t")
    if text.startswith(" ") or text.endswith(" "):
        text_node.set(qn("xml:space"), "preserve")
    text_node.text = text
    new_r.append(text_node)
    source_run._r.addnext(new_r)
    new_run = source_run._parent.part.document._body._parent if False else None
    # Accessing the paragraph runs again gives python-docx a regular Run wrapper.
    for candidate in source_run._parent.runs:
        if candidate._r is new_r:
            new_run = candidate
            break
    if new_run is None:
        raise RuntimeError("Impossible de créer le texte remplacé dans le document Word.")
    if black:
        new_run.font.color.rgb = RGBColor(0, 0, 0)
    return new_run


def replace_field_in_paragraph(paragraph: Paragraph, field: str, value: str) -> int:
    """Replace one field, preserving surrounding runs and forcing inserted text to black."""
    token = f"{{{{{field}}}}}"
    replacements = 0
    while True:
        texts = [run.text for run in paragraph.runs]
        joined = "".join(texts)
        start = joined.find(token)
        if start < 0:
            break
        end = start + len(token)
        offset = 0
        start_index = end_index = None
        start_offset = end_offset = 0
        for index, text in enumerate(texts):
            next_offset = offset + len(text)
            if start_index is None and start < next_offset:
                start_index, start_offset = index, start - offset
            if end <= next_offset:
                end_index, end_offset = index, end - offset
                break
            offset = next_offset
        if start_index is None or end_index is None:
            raise ValueError(f"Le champ {token} est incomplet dans le modèle.")
        start_run = paragraph.runs[start_index]
        end_run = paragraph.runs[end_index]
        before = start_run.text[:start_offset]
        after = end_run.text[end_offset:]
        start_run.text = before
        if start_index != end_index:
            for index in range(start_index + 1, end_index):
                paragraph.runs[index].text = ""
            end_run.text = after
        elif after:
            _clone_run_with_text(start_run, after)
        _clone_run_with_text(start_run, value, black=True)
        replacements += 1
    return replacements


def clean_values(raw_values: dict) -> dict[str, str]:
    values: dict[str, str] = {}
    for key, value in raw_values.items():
        if not isinstance(key, str):
            continue
        field = key.strip().upper()
        if FIELD_PATTERN.fullmatch(f"{{{{{field}}}}}") is None:
            continue
        values[field] = "" if value is None else str(value).strip()
    return values


def warning_for_values(values: dict[str, str]) -> list[str]:
    warnings: list[str] = []
    recipient = values.get(REQUIRED_FIELD, "")
    if len(recipient) > 30:
        warnings.append("Destinataire long : vérifiez l’aperçu, un retour à la ligne peut être nécessaire.")
    if len(values.get("CONTACT", "")) > 42:
        warnings.append("Contact long : vérifiez l’aperçu de la zone destinataire.")
    if len(values.get("ADRESSE", "")) > 65:
        warnings.append("Adresse longue : vérifiez l’aperçu de la zone d’adresse.")
    if len(values.get("LOCALITE", "")) > 36:
        warnings.append("Localité longue : vérifiez l’aperçu de la zone d’adresse.")
    telephone = values.get("TELEPHONE", "")
    if telephone and not PHONE_PATTERN.fullmatch(telephone):
        warnings.append("Téléphone à vérifier : conservez les chiffres et le préfixe international si nécessaire.")
    return warnings


def validate_template(document: Document) -> tuple[list[str], dict[str, int]]:
    fields, counts, malformed = inspect_fields(document)
    if malformed:
        raise ValueError(f"Champ(s) de fusion invalide(s) : {', '.join(malformed)}. Utilisez uniquement {{NOM_DU_CHAMP}}.")
    if REQUIRED_FIELD not in fields:
        raise ValueError("Le modèle doit contenir le champ obligatoire {{DESTINATAIRE}}.")
    return fields, counts


def create_letter(template_path: Path, destination_path: Path, raw_values: dict) -> None:
    document = Document(template_path)
    fields, counts = validate_template(document)
    values = clean_values(raw_values)
    if not values.get(REQUIRED_FIELD):
        raise ValueError("La valeur du champ obligatoire {{DESTINATAIRE}} est manquante.")
    replacements = 0
    for paragraph in iter_document_paragraphs(document):
        for field in fields:
            replacements += replace_field_in_paragraph(paragraph, field, values.get(field, ""))
    expected = sum(counts.values())
    if replacements != expected:
        raise ValueError("Un ou plusieurs champs du modèle n’ont pas pu être remplacés de manière contrôlée.")
    document.save(destination_path)


def safe_stem(value: str) -> str:
    compact = re.sub(r"[^A-Za-z0-9À-ÿ_-]+", "_", value.strip())
    return compact.strip("_")[:72] or "destinataire"


def convert_to_pdf(docx_files: list[Path], pdf_dir: Path) -> list[Path]:
    if not docx_files:
        return []
    pdf_dir.mkdir(parents=True, exist_ok=True)
    profile_dir = Path(tempfile.mkdtemp(prefix="courrier-ea-lo-"))
    command = [
        "libreoffice",
        "--headless",
        f"-env:UserInstallation={profile_dir.as_uri()}",
        "--convert-to",
        "pdf",
        "--outdir",
        str(pdf_dir),
        *[str(path) for path in docx_files],
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=150)
    shutil.rmtree(profile_dir, ignore_errors=True)
    if result.returncode != 0:
        raise RuntimeError(f"La conversion PDF a échoué : {result.stderr or result.stdout}")
    pdf_files = [pdf_dir / f"{path.stem}.pdf" for path in docx_files]
    missing = [str(path.name) for path in pdf_files if not path.exists()]
    if missing:
        raise RuntimeError(f"Les PDF suivants n’ont pas été produits : {', '.join(missing)}")
    return pdf_files


def merge_pdfs(pdf_files: list[Path], output_path: Path) -> None:
    writer = PdfWriter()
    for path in pdf_files:
        reader = PdfReader(path)
        for page in reader.pages:
            writer.add_page(page)
    with output_path.open("wb") as stream:
        writer.write(stream)


def rows_from_headers(headers: list[str], records: list[list[object]]) -> dict:
    normalized_headers = [header.strip() for header in headers]
    if not any(normalized_headers):
        raise ValueError("La source ne contient aucun en-tête exploitable.")
    normalized = [header.casefold() for header in normalized_headers]
    if "destinataire" not in normalized:
        raise ValueError("Aucune colonne « Destinataire » n’a été trouvée.")
    destination_index = normalized.index("destinataire")
    rows = []
    recipients = []
    for row_number, row in enumerate(records, start=2):
        values = {
            header: "" if index >= len(row) or row[index] is None else str(row[index]).strip()
            for index, header in enumerate(normalized_headers)
            if header
        }
        if not any(values.values()):
            continue
        name = values.get(normalized_headers[destination_index], "")
        issues = [] if name else ["Destinataire manquant."]
        row_data = {"rowNumber": row_number, "values": values, "name": name, "issues": issues}
        rows.append(row_data)
        if name:
            recipients.append({"name": name, "warning": warning_for_values({REQUIRED_FIELD: name})[0] if warning_for_values({REQUIRED_FIELD: name}) else None})
    if not rows:
        raise ValueError("La liste ne contient aucune ligne exploitable.")
    return {"headers": normalized_headers, "columnName": normalized_headers[destination_index], "rows": rows, "recipients": recipients}


def inspect_model(args: argparse.Namespace) -> dict:
    document = Document(args.template)
    fields, counts, malformed = inspect_fields(document)
    valid = REQUIRED_FIELD in fields and not malformed
    return {
        "fields": fields,
        "fieldCounts": counts,
        "invalidFields": malformed,
        "placeholder": f"{{{{{REQUIRED_FIELD}}}}}",
        "placeholderCount": counts.get(REQUIRED_FIELD, 0),
        "valid": valid,
    }


def inspect_excel(args: argparse.Namespace) -> dict:
    workbook = load_workbook(args.excel, read_only=True, data_only=True)
    worksheet = workbook.active
    iterator = worksheet.iter_rows(values_only=True)
    try:
        headers = ["" if value is None else str(value).strip() for value in next(iterator)]
    except StopIteration:
        raise ValueError("Le fichier Excel est vide.")
    return rows_from_headers(headers, [list(row) for row in iterator])


def inspect_pasted_table(args: argparse.Namespace) -> dict:
    content = Path(args.table).read_text(encoding="utf-8").strip()
    if not content:
        raise ValueError("Le tableau collé est vide.")
    lines = [line for line in content.splitlines() if line.strip()]
    if len(lines) < 2:
        raise ValueError("Collez une ligne d’en-têtes et au moins une ligne de données.")
    candidates = ["\t", ";", ",", "|"]
    delimiter = max(candidates, key=lambda candidate: lines[0].count(candidate))
    if lines[0].count(delimiter) == 0:
        raise ValueError("Séparez les colonnes avec des tabulations, des points-virgules, des virgules ou le caractère |.")
    parsed = list(csv.reader(io.StringIO("\n".join(lines)), delimiter=delimiter))
    headers = [cell.strip() for cell in parsed[0]]
    return rows_from_headers(headers, parsed[1:])


def preview(args: argparse.Namespace) -> dict:
    output_docx = Path(args.output_docx)
    output_pdf = Path(args.output_pdf)
    output_docx.parent.mkdir(parents=True, exist_ok=True)
    values = json.loads(Path(args.values_json).read_text(encoding="utf-8"))
    cleaned_values = clean_values(values)
    create_letter(Path(args.template), output_docx, cleaned_values)
    convert_to_pdf([output_docx], output_pdf.parent)
    generated_pdf = output_pdf.parent / f"{output_docx.stem}.pdf"
    if generated_pdf != output_pdf:
        generated_pdf.replace(output_pdf)
    return {"docx": str(output_docx), "pdf": str(output_pdf), "warnings": warning_for_values(cleaned_values)}


def generate(args: argparse.Namespace) -> dict:
    template_path = Path(args.template)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    recipients = json.loads(Path(args.recipients_json).read_text(encoding="utf-8"))
    if not recipients:
        raise ValueError("La campagne ne contient aucun destinataire.")
    docx_files = []
    for position, recipient in enumerate(recipients, start=1):
        raw_values = recipient.get("values", recipient)
        values = clean_values(raw_values)
        name = values.get(REQUIRED_FIELD, "")
        if not name:
            continue
        output_path = output_dir / f"Lettre_{position:03d}_{safe_stem(name)}.docx"
        create_letter(template_path, output_path, values)
        docx_files.append(output_path)
    if not docx_files:
        raise ValueError("Aucun courrier n’a pu être généré.")
    zip_path = Path(args.zip_output)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in docx_files:
            archive.write(path, arcname=path.name)
    pdf_files = convert_to_pdf(docx_files, output_dir / "pdf")
    pdf_path = Path(args.pdf_output)
    merge_pdfs(pdf_files, pdf_path)
    return {"count": len(docx_files), "zip": str(zip_path), "pdf": str(pdf_path)}


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_model_parser = subparsers.add_parser("inspect-model")
    inspect_model_parser.add_argument("--template", required=True)

    inspect_excel_parser = subparsers.add_parser("inspect-excel")
    inspect_excel_parser.add_argument("--excel", required=True)

    inspect_table_parser = subparsers.add_parser("inspect-table")
    inspect_table_parser.add_argument("--table", required=True)

    preview_parser = subparsers.add_parser("preview")
    preview_parser.add_argument("--template", required=True)
    preview_parser.add_argument("--values-json", required=True)
    preview_parser.add_argument("--output-docx", required=True)
    preview_parser.add_argument("--output-pdf", required=True)

    generate_parser = subparsers.add_parser("generate")
    generate_parser.add_argument("--template", required=True)
    generate_parser.add_argument("--recipients-json", required=True)
    generate_parser.add_argument("--output-dir", required=True)
    generate_parser.add_argument("--zip-output", required=True)
    generate_parser.add_argument("--pdf-output", required=True)

    args = parser.parse_args()
    if args.command == "inspect-model":
        result = inspect_model(args)
    elif args.command == "inspect-excel":
        result = inspect_excel(args)
    elif args.command == "inspect-table":
        result = inspect_pasted_table(args)
    elif args.command == "preview":
        result = preview(args)
    else:
        result = generate(args)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
