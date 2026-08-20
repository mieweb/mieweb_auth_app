Place the MIEWeb Auth source logo here as `logo.png` (square, 1024x1024 PNG),
then generate the platform assets into `resources/`:

    python3 generate_app_resources.py branding/mieauth/logo.png branding/mieauth/resources

`scripts/apply-variant.sh mie` copies `resources/` over `public/resources/` at
build time. Keeping them separate means the opensource app's artwork in
`public/resources/` is never modified in git.
