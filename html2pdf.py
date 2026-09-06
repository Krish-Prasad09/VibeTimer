import sys
import asyncio
import os
try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Error: 'playwright' is not installed.")
    print("Please run the following commands to install it:")
    print("1. pip install playwright")
    print("2. playwright install chromium")
    sys.exit(1)

async def convert_html_to_pdf(html_path):
    if not os.path.exists(html_path):
        print(f"Error: File '{html_path}' not found.")
        return

    # Create absolute path for browser
    abs_html_path = f"file:///{os.path.abspath(html_path).replace(chr(92), '/')}"
    pdf_path = os.path.splitext(html_path)[0] + '.pdf'

    print(f"Converting '{html_path}' to '{pdf_path}'...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Load the HTML file
        await page.goto(abs_html_path, wait_until='networkidle')
        
        # Wait a bit longer to ensure Tailwind CDN and Google Fonts render completely
        await page.wait_for_timeout(2500)
        
        # Generate PDF with exact colors and zero margins
        await page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True
        )
        
        await browser.close()
        
    print(f"Success! PDF saved to: {pdf_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python html2pdf.py <path_to_html_file.html>")
        sys.exit(1)
        
    html_file = sys.argv[1]
    asyncio.run(convert_html_to_pdf(html_file))
