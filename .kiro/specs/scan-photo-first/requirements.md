# Requirements Document

## Introduction

When a user photographs a bottle, the Reverse Scan currently discards their real photo and shows an AI-generated "chiaroscuro portrait" of what the model imagines the bottle looks like. In practice the generated image rarely matches the actual bottle, so the user ends up with a pretty but wrong picture in place of an accurate one. It also costs an image-generation call and adds a visible "Pouring..." step to every photo scan.

This change makes the scan photo-first: when the user provides a photo, that photo becomes the entry's image and no portrait is generated. Generation is kept only for scans where there is no photo to use (typed or spoken identification), so the cellar mosaic still looks composed when a real image does not exist.

The effect: cellar images match the bottles the user actually holds, the largest image-cost driver drops to only text/voice scans, and photo scans lose a latency step. This is a behavioral change to the identification path only. The data model, the save contract, the pairings path, and the enrichment step are unchanged.

## Glossary

- **Reverse_Scan**: The identification flow that returns a single editorial card for a bottle-like subject.
- **Identification_Card**: The result of Reverse_Scan (identity fields, editorial text, and an optional image).
- **Captured_Photo**: The image the user supplied for this scan (camera capture or library pick), already uploaded and available as a URL.
- **Generated_Portrait**: The AI-generated chiaroscuro image produced from a text prompt describing the bottle.
- **Entry_Image**: The image stored on the saved cellar entry (`photoUrl`).
- **Image_Allowance**: The existing per-user / per-IP daily budget that gates image generation (cost guardrails).
- **Confidence_Level**: The identification certainty on the card: high, medium, or low.

## Requirements

### Requirement 1: Prefer the user's photo as the entry image

**User Story:** As an enthusiast who photographed a bottle, I want my cellar to show the bottle I actually photographed, so that the picture matches what is in my hand.

#### Acceptance Criteria

1. WHEN a Reverse_Scan is performed with a Captured_Photo, THE Reverse_Scan SHALL use the Captured_Photo as the Entry_Image.
2. WHEN a Reverse_Scan is performed with a Captured_Photo, THE Reverse_Scan SHALL NOT generate a Generated_Portrait.
3. WHEN a Reverse_Scan is performed with a Captured_Photo, THE Reverse_Scan SHALL NOT consume Image_Allowance and SHALL NOT increment the image counter.
4. WHEN a scan with a Captured_Photo is saved, THE saved entry's Entry_Image SHALL be the Captured_Photo.

### Requirement 2: Keep generation only when there is no photo

**User Story:** As a user who typed or spoke a bottle name, I want the entry to still have a fitting image, so that my cellar mosaic does not have a blank where a photo would be.

#### Acceptance Criteria

1. WHEN a Reverse_Scan is performed without a Captured_Photo (typed or spoken input), THE Reverse_Scan SHALL generate a Generated_Portrait as it does today, subject to the existing Image_Allowance and Confidence_Level gates.
2. WHERE image generation is skipped for a no-photo scan because the Image_Allowance is exhausted or the Confidence_Level is low, THE Reverse_Scan SHALL return the card without an Entry_Image, consistent with today's portrait-absent behavior.
3. WHEN a Generated_Portrait is produced for a no-photo scan, THE Reverse_Scan SHALL increment the image counter exactly as it does today.

### Requirement 3: Preserve the streaming and save contracts

**User Story:** As a user, I want the scan to behave the same in every other respect, so that nothing else about the flow changes.

#### Acceptance Criteria

1. WHEN a Reverse_Scan has a Captured_Photo, THE Reverse_Scan SHALL NOT emit the image-generation status step, since no generation occurs.
2. THE Reverse_Scan SHALL continue to stream the complete editorial card as it does today, independent of whether the Entry_Image is a Captured_Photo or a Generated_Portrait.
3. THE save path SHALL persist the Entry_Image without requiring any change to the save input contract or the data model.
4. THE pairings path and the web-enrichment step SHALL be unchanged by this feature.
5. WHEN the identification confidence is low with a Captured_Photo present, THE Reverse_Scan SHALL still use the Captured_Photo as the Entry_Image, since using the user's own photo does not depend on identification certainty.
