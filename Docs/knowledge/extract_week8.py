from pathlib import Path
from pypdf import PdfReader

BASE = Path(__file__).resolve().parent


def extract_all(pdf_name: str, txt_name: str) -> None:
    pdf_path = BASE / pdf_name
    txt_path = BASE / txt_name

    reader = PdfReader(str(pdf_path))

    parts = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        parts.append(
            f"PAGE {page_number}\n{text.strip()}"
        )

    txt_path.write_text(
        "\n\n".join(parts),
        encoding="utf-8"
    )

    print(
        f"Created {txt_name} "
        f"({len(reader.pages)} pages)"
    )


def extract_pages(
    pdf_name: str,
    txt_name: str,
    start_page: int,
    end_page: int,
) -> None:
    pdf_path = BASE / pdf_name
    txt_path = BASE / txt_name

    reader = PdfReader(str(pdf_path))

    parts = []

    for page_number in range(
        start_page,
        min(end_page, len(reader.pages)) + 1,
    ):
        page = reader.pages[page_number - 1]
        text = page.extract_text() or ""

        parts.append(
            f"PAGE {page_number}\n{text.strip()}"
        )

    txt_path.write_text(
        "\n\n".join(parts),
        encoding="utf-8"
    )

    print(
        f"Created {txt_name} "
        f"(pages {start_page}-{end_page})"
    )


def main() -> None:
    # Real Estate Primer: all 8 pages
    extract_all(
        "Real_Estate_Primer.pdf",
        "Real_Estate_Primer.txt",
    )

    # Trestle metadata: all 36 pages
    extract_all(
        "Trestle_Property_MetaData.pdf",
        "Trestle_Property_Metadata.txt",
    )

    # Handbook schema:
    # Pages 4-6 contain the rets_property and
    # california_sold schema reference.
    extract_pages(
        "AI_Agentic_Engineer_Intern_Handbook_2026_v2.pdf",
        "IDX_Handbook_Schema.txt",
        4,
        6,
    )

    print("\nWeek 8 extraction complete.")


if __name__ == "__main__":
    main()