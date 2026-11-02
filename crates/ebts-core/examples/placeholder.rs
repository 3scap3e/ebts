use std::path::Path;

use ebts_core::generate::{generate_item_with, Job, PlaceholderProvider, Provider};
use ebts_core::manifest::content_manifest;
use ebts_core::{example, pixel};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let out = args.first().map(String::as_str).unwrap_or("placeholder-demo");
    let root = Path::new(out);
    let event = example::channelhack();
    let items = content_manifest(&event, Some(root));
    let mut written = 0;
    for item in items.iter().filter(|i| !i.kind.is_video()) {
        let provider = PlaceholderProvider::for_event(&event, &item.label);
        let done = generate_item_with(root, item, &provider).expect("placeholder render");
        println!("{}", root.join(done.path).display());
        written += 1;
    }
    let sample = PlaceholderProvider::new("Sample", "Portrait check", pixel::YELLOW)
        .generate_image(&Job::image("A tall poster used to check wrapping and centering of the placeholder text", 1080, 1920))
        .expect("render");
    std::fs::write(root.join("portrait.png"), sample).expect("write");
    println!("{written} posters + portrait.png written under {}", root.display());
}
