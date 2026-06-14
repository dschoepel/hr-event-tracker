---
name: release
description: Bump the version, update CHANGELOG.md, create a git tag, and push to trigger CI/CD. Run this when you are ready to cut a new release.
disable-model-invocation: false
---

You are executing the `/release` skill for hr-event-tracker. Orchestrate a full release:

1. **Check working tree**: Run `git status`. Confirm there are no uncommitted changes. If there are, stop and ask the user to commit or stash them first.

2. **Determine new version**: Ask the user for the new version number (e.g. `1.2.0`). Default: increment the patch version shown in `VERSION.md`. Strip any leading `v` for consistency in CHANGELOG dates, but write with `v` prefix to VERSION.md.

3. **Update VERSION.md**: Write the new version as a single line: `v<version>\n`

4. **Update CHANGELOG.md**:
   - Find the `## [Unreleased]` section
   - Replace it with `## [<version>] - <today's date in YYYY-MM-DD>`
   - Insert a new empty `## [Unreleased]` section above it
   - If `[Unreleased]` has no content, add `### Changed\n- Version bump` before the dated section

5. **Update RELEASE.md**: Prepend the new release section to the top of the existing RELEASE.md content. Do not replace the file — read the current contents first, then write the new section followed by a blank line and the previous contents.

   Write the release notes in **user-facing language**, not technical changelog prose:
   - Focus on what the user gains, not what files or functions changed
   - Use plain English: "You can now…", "Events now show…", "Fixed an issue where…"
   - Group under headings like "What's New", "Improvements", "Bug Fixes" — skip any heading that has no entries
   - Avoid implementation details (file names, function names, config keys) unless they are meaningful to the user
   - For the very first release, include a brief description of what the app does before listing features

6. **Commit**: Stage and commit all three files:
   ```
   git add VERSION.md CHANGELOG.md RELEASE.md
   git commit -m "chore: release v<version>"
   ```

7. **Tag**: `git tag v<version>`

8. **Push**: `git push && git push --tags`
   This triggers GitHub Actions → builds Docker image → pushes to GHCR.

9. **Report**: Print the GitHub Actions URL so the user can monitor the build:
   `https://github.com/dschoepel/hr-event-tracker/actions`

After pushing, the CI build takes 2–5 minutes. When it's green, run `/deploy` to deploy to the VPS.
