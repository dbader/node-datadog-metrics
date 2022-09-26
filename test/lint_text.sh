#!/usr/bin/env bash
set -euo pipefail

# Find and log lines with "DataDog" or "dataDog", but allow "DataDogReporter"
# and "github.com/DataDog", etc. This uses grep to find all lines with
# "DataDog", then awk to filter out the lines that only have allowed patterns
# (but not the lines that have both allowed patterns and "DataDog").
#
# This could be done in one step with negative lookahead assertions in grep,
# but that requires PCRE2, and many people have grep without PCRE2 support.
bad_lines=$(
    grep                           \
        -r                         \
        --exclude lint_text.sh     \
        --exclude-dir node_modules \
        --exclude-dir .git         \
        --line-number              \
        --extended-regexp          \
        '[dD]ataDog'               \
        .                          \
        | awk '
            # Store the raw line then remove allowed patterns before processing.
            {raw_line=$0; gsub(/github\.com\/DataDog/,"")}
            # Print every line that has DataDog in it.
            /[dD]ataDog/ {print raw_line}
        '
)

if [ -n "${bad_lines}" ]; then
    echo 'The correct spelling of "Datadog" does not capitalize the second "D".'
    echo 'Please fix these lines:'
    echo ''
    echo "${bad_lines}"
    echo ''

    line_count=$(echo "${bad_lines}" | wc -l | sed 's/[[:space:]]//g')
    echo "$line_count errors."

    exit 1
fi
