"""
Shared reference data for stages that render the garment on a fixed model
persona (3D Visualization, Photoshoot). Single source of truth so both
stages stay consistent — the model shown in Stage 7 should match the one
picked in Stage 6.
"""

CATEGORY_DISPLAY_NAMES = {
    "SHIRT": "Shirt",
    "TEE": "Tee",
    "TOP": "Top",
    "DRESS": "Dress",
    "SKIRT": "Skirt",
    "PANT": "Pant",
    "SHORT": "Short",
    "JACKET": "Jacket",
    "SWTSHRT": "Sweatshirt",
    "JUMP": "Jumpsuit",
}

UPPER_BODY_CATEGORIES = {"SHIRT", "TEE", "TOP", "JACKET", "SWTSHRT"}
LOWER_BODY_CATEGORIES = {"PANT", "SHORT", "SKIRT"}
FULL_BODY_CATEGORIES = {"DRESS", "JUMP"}

# Exactly two fixed personas — picking the model IS picking the gender.
MODEL_DESCRIPTIONS = {
    "Model A": "Male, 6 feet tall, white British, 24 years old, lean and slim build, clean haircut. Wearing size UK Large.",
    "Model B": "Female, 5 feet 8 inches tall, white British, 24 years old, lean and slim build, tied hair. Wearing size UK Large.",
}

DEFAULT_MODEL_AVATAR = "Model A"


def category_display_name(category_code: str) -> str:
    return CATEGORY_DISPLAY_NAMES.get(category_code.upper(), category_code.title())


def model_description(model_avatar: str) -> str:
    return MODEL_DESCRIPTIONS.get(model_avatar, MODEL_DESCRIPTIONS[DEFAULT_MODEL_AVATAR])


def framing_logic(category_code: str) -> str:
    """Category-driven crop/framing rule, used by Stage 6 (3D Visualization)."""
    cat = category_code.upper()
    if cat in UPPER_BODY_CATEGORIES:
        return (
            "Medium shot framing: There must be visible space above the model's head, "
            "and the image must crop/end exactly at the mid-knee."
        )
    if cat in LOWER_BODY_CATEGORIES:
        return (
            "Lower body focus framing: There must be visible space below the model's feet, "
            "and the image must crop/end exactly just under the chest. Do not show the model's head."
        )
    if cat in FULL_BODY_CATEGORIES:
        return (
            "Full body wide framing: The entire body must be in the frame with visible space "
            "above the head and visible space below the feet."
        )
    return "Full body framing."
