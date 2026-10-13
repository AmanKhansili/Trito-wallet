#!/usr/bin/env python3
r"""Render visual preview images of documents (.pdf, .docx, .pptx, .xlsx).

Converts Office documents to PDF using headless LibreOffice, and rasterizes
PDF pages to high-resolution PNG images using pypdfium2 for visual inspection
via view_file.

Usage:
    python3 skills/file-generation/scripts/render_preview.py \
        <filepath> [--pages N] [--scale S]

Args:
    filepath: Path to .pdf, .docx, .pptx, or .xlsx file. --pages: Maximum number
      of pages/slides to render (default: 3). --scale: Render scale / resolution
      factor (default: 2 for 144 DPI).

Outputs:
    Prints paths to rendered PNG images:
    Rendered: artifacts/file_generation/ttl=63d/intermediate/document_page_1.png
"""

import argparse
import pathlib
import subprocess
import sys


def render_pdf(
    pdf_path: pathlib.Path, max_pages: int = 3, scale: float = 2.0
) -> list[pathlib.Path]:
  """Rasterizes PDF pages into PNG images using pypdfium2."""
  # pylint: disable=g-import-not-at-top
  import pypdfium2 as pdfium

  pdf = pdfium.PdfDocument(str(pdf_path))
  total_pages = len(pdf)
  print(f"Total pages: {total_pages}, size: {pdf_path.stat().st_size} bytes")
  if total_pages == 0:
    print("FAIL: Document contains 0 pages")
    pdf.close()
    return []

  if pdf_path.parent.name == "output":
    intermediate_dir = pdf_path.parent.parent / "intermediate"
  else:
    intermediate_dir = pdf_path.parent
  intermediate_dir.mkdir(parents=True, exist_ok=True)

  rendered_images = []
  num_to_render = min(total_pages, max_pages)
  for i in range(num_to_render):
    image_file = intermediate_dir / f"{pdf_path.stem}_page_{i+1}.png"
    pdf[i].render(scale=scale).to_pil().save(image_file)
    rendered_images.append(image_file)
    print(f"Rendered: {image_file}")

  pdf.close()
  return rendered_images


def convert_office_to_pdf(doc_path: pathlib.Path) -> pathlib.Path:
  """Converts an Office document (.docx, .pptx, .xlsx) to PDF via LibreOffice."""
  if doc_path.parent.name == "output":
    intermediate_dir = doc_path.parent.parent / "intermediate"
  else:
    intermediate_dir = doc_path.parent
  intermediate_dir.mkdir(parents=True, exist_ok=True)

  try:
    subprocess.run(
        [
            "libreoffice",
            "--headless",
            "--nologo",
            "--nolockcheck",
            "--convert-to",
            "pdf",
            "--outdir",
            str(intermediate_dir),
            str(doc_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
  except subprocess.CalledProcessError as e:
    raise RuntimeError(
        f"LibreOffice conversion failed: {e.stderr or e.stdout}"
    ) from e
  except subprocess.TimeoutExpired as e:
    raise RuntimeError(
        f"LibreOffice conversion timed out after 60s for {doc_path}"
    ) from e

  pdf_path = intermediate_dir / f"{doc_path.stem}.pdf"
  if not pdf_path.exists() or pdf_path.stat().st_size == 0:
    raise RuntimeError(f"PDF conversion output missing or empty for {doc_path}")
  return pdf_path


def render_document_preview(
    filepath: str, max_pages: int = 3, scale: float = 2.0
) -> list[pathlib.Path]:
  """Renders preview images for any supported document format."""
  doc_path = pathlib.Path(filepath).resolve()
  if not doc_path.exists():
    print(f"FAIL: File not found: {doc_path}")
    sys.exit(1)

  if doc_path.stat().st_size == 0:
    print(f"FAIL: File is 0 bytes: {doc_path}")
    sys.exit(1)

  extension = doc_path.suffix.lower()

  if extension == ".pdf":
    pdf_path = doc_path
  elif extension in (".docx", ".pptx", ".xlsx", ".doc", ".ppt", ".xls"):
    print(f"Converting {extension} to PDF via LibreOffice...")
    try:
      pdf_path = convert_office_to_pdf(doc_path)
    except Exception as e:  # pylint: disable=broad-exception-caught
      print(f"FAIL: Conversion error: {e}")
      sys.exit(1)
  else:
    print(f"FAIL: Unsupported extension for visual preview: {extension}")
    sys.exit(1)

  rendered = render_pdf(pdf_path, max_pages=max_pages, scale=scale)
  if not rendered:
    sys.exit(1)
  return rendered


def main():
  """Main entrypoint for render_preview."""
  parser = argparse.ArgumentParser(
      description="Render visual preview images of documents."
  )
  parser.add_argument("filepath", help="Path to document file.")
  parser.add_argument(
      "--pages",
      type=int,
      default=3,
      help="Maximum number of pages/slides to render (default: 3).",
  )
  parser.add_argument(
      "--scale",
      type=float,
      default=2.0,
      help="Render scale (default: 2.0 / 144 DPI).",
  )

  args = parser.parse_args()
  render_document_preview(args.filepath, max_pages=args.pages, scale=args.scale)


if __name__ == "__main__":
  main()
