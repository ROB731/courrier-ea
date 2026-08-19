from pathlib import Path

from docx import Document
from docx.shared import Pt


output = Path("/tmp/courrier-ea-multifield-model.docx")
document = Document()
paragraph = document.add_paragraph()
run = paragraph.add_run("À l’attention de la Direction\n")
run.font.name = "Arial"
run.font.size = Pt(11)
for text in ("{{DESTINATAIRE}}\n", "{{CONTACT}}\n", "{{ADRESSE}}\n", "{{LOCALITE}}\n", "Tél. : {{TELEPHONE}}"):
    field_run = paragraph.add_run(text)
    field_run.font.name = "Arial"
    field_run.font.size = Pt(11)
document.save(output)
print(output)
