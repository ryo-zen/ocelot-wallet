// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

fn main() {
    println!("cargo:rerun-if-env-changed=OCELOT_BUILD_CHANNEL");
    println!("cargo:rerun-if-env-changed=OCELOT_COMMIT_SHA");
    register_git_rerun_paths();

    let commit_sha = build_commit_sha();
    let channel = build_channel();

    validate_header_value("OCELOT_COMMIT_SHA", &commit_sha);
    validate_header_value("OCELOT_BUILD_CHANNEL", &channel);

    if channel == "official" && commit_sha == "unknown" {
        panic!("official Ocelot builds must include a known OCELOT_COMMIT_SHA");
    }

    println!("cargo:rustc-env=OCELOT_COMMIT_SHA={commit_sha}");
    println!("cargo:rustc-env=OCELOT_BUILD_CHANNEL={channel}");

    tauri_build::build()
}

fn register_git_rerun_paths() {
    println!("cargo:rerun-if-changed=../.git/HEAD");

    let Ok(head) = std::fs::read_to_string("../.git/HEAD") else {
        return;
    };

    let Some(ref_path) = head.trim().strip_prefix("ref: ") else {
        return;
    };

    println!("cargo:rerun-if-changed=../.git/{ref_path}");
}

fn build_commit_sha() -> String {
    std::env::var("OCELOT_COMMIT_SHA")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| git_commit_sha().unwrap_or_else(|| "unknown".to_string()))
}

fn git_commit_sha() -> Option<String> {
    let output = std::process::Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let commit = String::from_utf8(output.stdout).ok()?;
    let commit = commit.trim();

    (!commit.is_empty()).then(|| commit.to_string())
}

fn build_channel() -> String {
    std::env::var("OCELOT_BUILD_CHANNEL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "local".to_string())
}

fn validate_header_value(name: &str, value: &str) {
    let is_valid = !value.is_empty() && value.bytes().all(|byte| matches!(byte, b'!'..=b'~'));

    if !is_valid {
        panic!("{name} must be a non-empty visible ASCII header value");
    }
}
