from pathlib import Path
from tempfile import TemporaryDirectory

from docx import Document
from docx.shared import RGBColor

from courrier_engine import create_letter


def test_replaced_recipient_is_black() -> None:
    with TemporaryDirectory() as directory:
        root = Path(directory)
        template = root / "template.docx"
        output = root / "output.docx"

        document = Document()
        paragraph = document.add_paragraph()
        run = paragraph.add_run("{{DESTINATAIRE}}")
        run.font.color.rgb = RGBColor(128, 128, 128)
        document.save(template)

        create_letter(template, output, {"DESTINATAIRE": "2I SA (IVOIRE INGENIERIES)"})
        generated = Document(output)
        recipient_run = next(run for run in generated.paragraphs[0].runs if run.text)
        assert recipient_run.text == "2I SA (IVOIRE INGENIERIES)"
        assert recipient_run.font.color.rgb == RGBColor(0, 0, 0)


if __name__ == "__main__":
    test_replaced_recipient_is_black()
    print("ok")
