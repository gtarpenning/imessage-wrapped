#!/usr/bin/env python3
"""
Run a small hyperparameter sweep for phrase extraction by invoking `imexport`
with different phrase configs. Adjust the combos below as needed.
"""

from __future__ import annotations

import argparse
import itertools
import subprocess
from pathlib import Path
from typing import Iterable


def build_label(cfg: dict[str, object]) -> str:
    return f"ng{cfg['ngmin']}-{cfg['ngmax']}_scorer-{cfg['scorer']}_len{cfg['length_bias']}"


def run_command(cmd: list[str]) -> None:
    print(f"\n→ Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def sweep(
    year: int,
    output_dir: Path,
    database: str | None,
    imexport_bin: str,
    combos: Iterable[dict[str, object]],
    share: bool = False,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    for cfg in combos:
        label = build_label(cfg)
        export_path = output_dir / f"export_{label}.jsonl"
        stats_path = output_dir / f"stats_{label}.json"

        cmd = [
            imexport_bin,
            "--year",
            str(year),
            "--output",
            str(export_path),
            "--format",
            "jsonl",
            "--replace-cache",
            "--phrase-ngram-min",
            str(cfg["ngmin"]),
            "--phrase-ngram-max",
            str(cfg["ngmax"]),
            "--phrase-scorer",
            str(cfg["scorer"]),
            "--phrase-score-mult",
            str(cfg["length_bias"]),
            "--stats-output",
            str(stats_path),
        ]

        if database:
            cmd += ["--database", database]
        if not share:
            cmd.append("--no-share")

        run_command(cmd)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sweep phrase extraction hyperparameters.")
    parser.add_argument("-y", "--year", type=int, default=None, help="Year to export")
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path("exports/phrase_sweeps"),
        help="Directory to store exports and stats",
    )
    parser.add_argument(
        "-d",
        "--database",
        type=str,
        help="Optional path to chat.db (defaults to system path if omitted)",
    )
    parser.add_argument(
        "--imexport-bin",
        type=str,
        default="imexport",
        help="imexport executable to invoke (default: imexport)",
    )
    parser.add_argument(
        "--share",
        action="store_true",
        help="Upload stats to the configured server (default: local only)",
    )
    args = parser.parse_args()

    # Define the sweep space here.
    ngram_mins = [1, 2]
    ngram_maxs = [3, 4, 5]
    scorers = ["tfidf", "frequency"]
    length_biases = [1.5, 2.1, 2.5]

    combos = []
    for ngmin, ngmax, scorer, lb in itertools.product(ngram_mins, ngram_maxs, scorers, length_biases):
        if ngmin > ngmax:
            continue
        combos.append({"ngmin": ngmin, "ngmax": ngmax, "scorer": scorer, "length_bias": lb})

    from datetime import datetime

    sweep(
        year=args.year or datetime.now().year,
        output_dir=args.output_dir,
        database=args.database,
        imexport_bin=args.imexport_bin,
        combos=combos,
        share=args.share,
    )


if __name__ == "__main__":
    main()
