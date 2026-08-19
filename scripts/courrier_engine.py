#!/usr/bin/env python3
"""Moteur documentaire de COURRIER EA.

Le script ne remplace jamais de contenu libre : il exige exactement une occurrence
de {{DESTINATAIRE}} dans le modèle avant toute génération.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Iterator

from docx import Document
from docx.text.paragraph import Paragraph
from openpyxl import load_workbook
from pypdf import PdfReader, PdfWriter

TOKEN = "{{DESTINATAIRE}}"


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


def token_count(document: Document) -> int:
    return sum("".join(run.text for run in paragraph.runs).count(TOKEN) for paragraph in iter_document_paragraphs(document))


def replace_token_in_paragraph(paragraph: Paragraph, recipient: str) -> int:
    """Replace one or more tokens while retaining the surrounding run styling."""
    replacements = 0
    while True:
        texts = [run.text for run in paragraph.runs]
        joined = "".join(texts)
        start = joined.find(TOKEN)
        if start < 0:
            break
        end = start + len(TOKEN)
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
            raise ValueError("Le champ de fusion est incomplet dans le modèle.")
        start_run = paragraph.runs[start_index]
        end_run = paragraph.runs[end_index]
        before = start_run.text[:start_offset]
        after = end_run.text[end_offset:]
        start_run.text = before + recipient + (after if start_index == end_index else "")
        if start_index != end_index:
            for index in range(start_index + 1, end_index):
                paragraph.runs[index].text = ""
            end_run.text = after
        replacements += 1
    return replacements


def create_letter(template_path: Path, destination_path: Path, recipient: str) -> None:
    document = Document(template_path)
    count = token_count(document)
    if count != 1:
        raise ValueError(
            f"Le modèle doit contenir exactement une occurrence de {TOKEN}. Occurrences trouvées : {count}."
        )
    replacements = sum(replace_token_in_paragraph(paragraph, recipient) for paragraph in iter_document_paragraphs(document))
    if replacements != 1:
        raise ValueError("Le champ destinataire n’a pas pu être remplacé de manière contrôlée.")
    document.save(destination_path)


def safe_stem(value: str) -> str:
    compact = re.sub(r"[^A-Za-z0-9À-ÿ_-]+", "_", value.strip())
    return compact.strip("_")[:72] or "destinataire"


def warning_for_recipient(name: str) -> str | None:
    if len(name.strip()) > 30:
        return "Nom long : vérifiez l’aperçu, un retour à la ligne peut être nécessaire."
    return None


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


def inspect_model(args: argparse.Namespace) -> dict:
    document = Document(args.template)
    count = token_count(document)
    return {"placeholder": TOKEN, "placeholderCount": count, "valid": count == 1}


def inspect_excel(args: argparse.Namespace) -> dict:
    workbook = load_workbook(args.excel, read_only=True, data_only=True)
    worksheet = workbook.active
    iterator = worksheet.iter_rows(values_only=True)
    try:
        headers = ["" if value is None else str(value).strip() for value in next(iterator)]
    except StopIteration:
        raise ValueError("Le fichier Excel est vide.")
    normalised = [header.casefold() for header in headers]
    if "destinataire" not in normalised:
        raise ValueError("Aucune colonne « Destinataire » n’a été trouvée.")
    destination_index = normalised.index("destinataire")
    recipients = []
    for row in iterator:
        value = row[destination_index] if destination_index < len(row) else None
        if value is None or not str(value).strip():
            continue
        name = str(value).strip()
        recipients.append({"name": name, "warning": warning_for_recipient(name)})
    if not recipients:
        raise ValueError("La colonne « Destinataire » ne contient aucun nom exploitable.")
    return {"headers": headers, "columnName": headers[destination_index], "recipients": recipients}


def preview(args: argparse.Namespace) -> dict:
    output_docx = Path(args.output_docx)
    output_pdf = Path(args.output_pdf)
    output_docx.parent.mkdir(parents=True, exist_ok=True)
    create_letter(Path(args.template), output_docx, args.recipient)
    convert_to_pdf([output_docx], output_pdf.parent)
    generated_pdf = output_pdf.parent / f"{output_docx.stem}.pdf"
    if generated_pdf != output_pdf:
        generated_pdf.replace(output_pdf)
    return {"docx": str(output_docx), "pdf": str(output_pdf), "warning": warning_for_recipient(args.recipient)}


def generate(args: argparse.Namespace) -> dict:
    template_path = Path(args.template)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    recipients = json.loads(Path(args.recipients_json).read_text(encoding="utf-8"))
    if not recipients:
        raise ValueError("La campagne ne contient aucun destinataire.")
    docx_files = []
    for position, recipient in enumerate(recipients, start=1):
        name = str(recipient["name"]).strip()
        if not name:
            continue
        output_path = output_dir / f"Lettre_{position:03d}_{safe_stem(name)}.docx"
        create_letter(template_path, output_path, name)
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

    preview_parser = subparsers.add_parser("preview")
    preview_parser.add_argument("--template", required=True)
    preview_parser.add_argument("--recipient", required=True)
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
