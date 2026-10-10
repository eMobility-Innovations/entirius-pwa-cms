const { test, guide, goto } = require("../support/capture");

// Guide "Sign in": the login form, the home screen, a sidebar group and the user menu. Writes nothing: the menu is
// opened and closed, no item is chosen.
const { shot } = guide("sign-in");

const LOG_IN = 'button:has-text("Log in")'; // login.submit
const SIDEBAR = '[data-fid="sidebar"]';
const USER_BUTTON = '[data-fid="user-button"]';
const USER_MENU = ".basic-menu__popover:visible";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("sign-in: the login form", async ({ page }) => {
    await test.step("Login form with the username typed", async () => {
      await goto(page, "/", { ready: LOG_IN, noAuth: true });
      await page.fill('input[type="text"]', "admin");
      await shot(page, "01-login", {
        callouts: [
          { target: '.auth-layout__body .form-field:has-text("Username")', label: "1" },
          { target: '.auth-layout__body .form-field:has-text("Password")', label: "2" },
          { target: LOG_IN, label: "3" },
        ],
      });
    });
  });
});

test("sign-in: home, sidebar group, user menu", async ({ page }) => {
  await test.step("Home", async () => {
    await goto(page, "/", { ready: '[data-fid="panel-card"]' });
    await shot(page, "02-home", {
      callouts: [
        { target: SIDEBAR, label: "1" },
        { target: '[data-fid="panel-card"]', label: "2" },
        { target: USER_BUTTON, label: "3" },
      ],
    });
  });

  await test.step("Sidebar with the PIM group open", async () => {
    await page.getByRole("navigation", { name: "Panels" }).getByRole("button", { name: "PIM" }).click();
    await shot(page, "03-sidebar-group", {
      element: SIDEBAR,
      padding: 0,
      callouts: [
        { target: ".sidebar-nav-group--open", label: "1" },
        { target: ".sidebar-nav__footer button[aria-expanded]", label: "2" },
      ],
    });
  });

  await test.step("User menu", async () => {
    await page.click(USER_BUTTON);
    await shot(page, "04-user-menu", {
      element: USER_MENU,
      padding: 8,
      callouts: [
        { target: 'role=menuitemradio[name="English"]', label: "1" },
        { target: ".basic-menu__item--danger", label: "2" },
      ],
    });
    await page.keyboard.press("Escape");
  });
});
