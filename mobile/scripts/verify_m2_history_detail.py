import os
import sys
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


APP_URL = os.environ.get("MOBILE_APP_URL", "http://127.0.0.1:5173")
USERNAME = os.environ.get("MOBILE_TEST_USERNAME", "widji")
PASSWORD = os.environ.get("MOBILE_TEST_PASSWORD", "P@ssw0rd.123")


def sign_in_if_needed(page):
    if page.get_by_role("button", name="Sign In").count() == 0:
      return

    page.get_by_label("Username or Email").fill(USERNAME)
    page.get_by_label("Password").fill(PASSWORD)
    page.get_by_role("button", name="Sign In").click()
    page.wait_for_load_state("networkidle")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 430, "height": 932})

        try:
            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            sign_in_if_needed(page)

            page.get_by_role("button", name="History").click()
            page.wait_for_load_state("networkidle")

            history_heading = page.get_by_role("heading", name="Recent Captures")
            history_heading.wait_for(timeout=15000)

            if page.get_by_text("No captures found").count():
                raise AssertionError("History screen loaded but returned no capture records.")

            first_card = page.locator(".history-card").first
            first_card.wait_for(timeout=15000)
            first_title = first_card.locator("h2").inner_text().strip()
            first_card.click()
            page.wait_for_load_state("networkidle")

            detail_heading = page.get_by_text("Capture Detail")
            detail_heading.wait_for(timeout=15000)
            metadata_title = page.get_by_role("heading", name="Metadata")
            metadata_title.wait_for(timeout=15000)

            page.screenshot(path="/tmp/mobile-m2-history-detail.png", full_page=True)

            print("M2 runtime verification passed.")
            print(f"History first item: {first_title}")
            print("Screenshot: /tmp/mobile-m2-history-detail.png")
        except (PlaywrightTimeoutError, AssertionError) as error:
            page.screenshot(path="/tmp/mobile-m2-history-detail-failure.png", full_page=True)
            print(str(error), file=sys.stderr)
            print("Failure screenshot: /tmp/mobile-m2-history-detail-failure.png", file=sys.stderr)
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    main()
