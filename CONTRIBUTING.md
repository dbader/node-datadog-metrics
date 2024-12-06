# Contributing

Contributions are welcome, and they are greatly appreciated! Every little bit helps, and credit will always be given.


## Ways to Contribute

### Report Bugs

Report bugs by [filing an issue][issues]. Please check to make sure someone hasn’t already raised the issue you are concerned about. When filing a new issue, please include:
- Any details about your local setup that might be helpful in troubleshooting.
- Detailed steps or a working code sample to reproduce the bug.


### Fix Bugs or Implement New Features

Look through the [issues][] for any that you might be able to help with. **Issues tagged with “bug” or “help wanted” are high priority** and we’d love help from anyone who has time to work on them. The “enhancement” tag indicates new features that would helpful to have, and we are happy to accept PRs for those, too.

Follow the [local development](#local-development) steps below to get started, then file a [pull request][pulls] with your work. Unless you have a compelling reason not to, please make sure to include new tests or update existing tests for your changes.


### Write Documentation

We could always use improvements to the documentation, whether to the README, this guide, the JSDoc strings in the code (which show up in some editors), or or even on the web in blog posts, articles, and such.

For changes to this repo, follow the [local development](#local-development) steps below to get started, then file a [pull request][pulls] with your work.


## Local Development

1. If you don't have commit rights to this repo, [fork it][fork].

2. Install Node.js 12 or newer.

3. Clone your fork (or this repo if you have commit rights) to your local development machine:

    ```sh
    git clone <path-to-your-fork>
    ```

4. Switch to the cloned directory and install dependencies:

    ```sh
    cd node-datadog-metrics
    npm install
    ```

5. Start a new branch to work in:

    ```sh
    git checkout -b name-of-your-branch
    ```

6. Make your changes to teh relevant files.

7. Run tests and other checks before committing!

    - Run tests: `npm test`
    - Check code style: `npm run check-codestyle && npm run check-text`
    - Build and check TypeScript types: `npm run build-types && npm run check-types`
    - **(Not required!)** If you have a Datadog account you can push test metrics to, run a complete, live integration check:

        ```sh
        export DATADOG_API_KEY='<api key for your test account>'
        export DATADOG_APP_KEY='<app key for your test account>'
        export DATADOG_SITE='<site for your test account>'
        npm run check-integration
        ```

    Most of these checks will also run automatically when you create a PR, but it can be good to run some of the quick checks yourself before pushing your code to get quicker feedback.

8. Commit and push your changes.

9. [Open a pull request][pulls] with your changes. A maintainer will


## Building/Publishing Releases

**Maintainers only.** We current publish new releases manually. To create a new release, follow these steps:

1. Pull and check out the latest `main` branch (or whatever branch is relevant if publishing a patch for a previous release).

2. Prepare for the release.
    - Most checks will have run in CI, but you may want to run them again locally if you’ve changed anything notable. (See [local development](#local-development) notes above.)

    - Update the version number in `package.json`.

    - Finalize the “release history” section of `README.md`:
        - Replace the “In Development:” heading with the version number and current date, e.g. “0.12.0 (2024-12-01)”

        - Do a quick review of the notes for this release and clean up any typos or reword anything that’s not clear. Remove any sections that are blank or just have “TBD” listed.

        - Replace the “view diff” link with a compare link for the new version number:

            ```
            https://github.com/dbader/node-datadog-metrics/compare/v<PREVIOUS_VERSION>...v<THIS_VERSION>
            ```

            For example, if the new version number is 0.12.0 and the previous was 0.11.4:

            ```
            https://github.com/dbader/node-datadog-metrics/compare/v0.11.4...v0.12.0
            ```

3. Commit and tag.
    - Commit your changes. The commit message should be something like `Prepare v<VERSION_NUMBER>`.
    - Tag the commit as `v<VERSION_NUMBER>`:

        ```sh
        git tag v<VERSION_NUMBER>
        ```

    - Push the commit and tags to GitHub:

        ```sh
        git push
        git push --tags
        ```

4. Publish to NPM!

    Make sure to choose an appropriate `--tag` value:
        - `latest` for a new current release.
        - `next` for a pre-release.
        - `v<VERSION>.x` for patches to non-current versions (e.g. if the current release is v0.12.1 but you are publishing v0.11.5, tag it as `v0.11.x`).

    Do a dry run with `--dry-run` before publishing just to make sure everything is good:

    ```sh
    npm run clean
    npm publish --dry-run --tag <TAG>
    ```

    If the results look good, go ahead and publish!

    ```sh
    npm publish --tag <TAG>
    ```

5. Create a release on GitHub at https://github.com/dbader/node-datadog-metrics/releases/new.
    - Choose the tag you pushed in step 3.
    - The title should be `Version <VERSION_NUMBER>`.
    - Paste the notes from the “release history” section of the README as the description. Make sure to indent properly (they are indented one level as a bulleted list item in the README).
    - Attach the tarball of the published package from NPM. (You can find the URL for it by running `npm view datadog-metrics`.)

6. Prepare for future development:
    - Add a new “in development” section to the top of the release history in `README.md`:

        ```markdown
        ### In Development:

        **Breaking Changes:**

        TBD

        **New Features:**

        TBD

        **Deprecations:**

        TBD

        **Bug Fixes:**

        TBD

        **Maintenance:**

        TBD

        [View diff](https://github.com/dbader/node-datadog-metrics/compare/v<VERSION_NUMBER>...main)
        ```

    - Update the version number in `package.json` to be `<NEXT_VERSION>-dev`, e.g. `0.12.1-dev` if you just published `0.12.0`.

    - Commit your changes and push to GitHub.


[issues]: https://github.com/dbader/node-datadog-metrics/issues
[pulls]: https://github.com/dbader/node-datadog-metrics/pulls
[fork]: https://github.com/dbader/node-datadog-metrics/fork
