# Local Authentication Verification

The local login page is available at `/login`. The automated authentication test verified the configured administrator credentials, the secure session cookie (`HttpOnly`, `Secure`, and `SameSite=None`), and the removal of the operational OAuth callback flow. The local login page was also verified in the browser.

The login page language toggle was verified in the browser in both directions. The English view renders `DgTera ERP`, `Username`, `Password`, and `Sign in` with left-to-right direction; switching back renders the Arabic title, labels, security note, and right-to-left direction.

The generated administrator credentials were entered through the local login form and the form submission invoked the local sign-in flow. The rendered-page check confirmed transition to the dashboard as `Local Administrator` and confirmed that the administration navigation group is visible for the administrator role.
