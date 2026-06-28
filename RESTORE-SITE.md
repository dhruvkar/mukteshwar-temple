# How to restore the site (it is currently OFFLINE)

As of **2026-06-28** (commit `977fd78`) this site is intentionally taken offline
and shows a temporary **under-construction** page at https://mukteshwar.org.
Everything that hides the site is marked with `--- TEMPORARY ... END TEMPORARY ---`
comment blocks. To bring the real site back, remove those blocks and push.

> Deploys are automatic: Netlify rebuilds whenever you push to `master`.
> You do **not** need to run `netlify deploy`.

## Steps

1. `cd` into this `site/` directory.

2. **`netlify.toml`** — delete the temporary `[[redirects]]` block:
   ```
   # --- TEMPORARY: site taken offline ... ---
   [[redirects]]
     from = "/*"
     to = "/under-construction.html"
     status = 200
     force = true
   # --- END TEMPORARY ---
   ```

3. **`netlify/functions/submit-booking.js`** and **`netlify/functions/dashboard.js`** —
   in each file delete the temporary 503 block at the very top of the handler:
   ```
   // --- TEMPORARY: site offline / under construction. Remove this block to restore. ---
   return new Response('Service temporarily unavailable.', { ... });
   // --- END TEMPORARY ---
   ```

4. (Optional) remove the now-unused files:
   ```
   git rm under-construction.html RESTORE-SITE.md
   ```

5. Commit and push — Netlify auto-redeploys:
   ```
   git add -A
   git commit -m "Restore site (remove under-construction page)"
   git push origin master
   ```

## Verify it's back

```
curl -s https://mukteshwar.org/ | grep -i "Temple of Liberation"      # real hero text returns
curl -s -o /dev/null -w "%{http_code}\n" https://mukteshwar.org/.netlify/functions/submit-booking   # no longer 503
```
