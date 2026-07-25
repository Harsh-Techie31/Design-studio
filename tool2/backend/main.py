import os
import json
import base64
import logging
import io
import math
from typing import Optional
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageOps, ImageChops
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("motif_repeater")

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Design Studio: Motif Repeater API",
    description="Backend API for scaling and replicating motif designs seamlessly on canvas."
)

def get_api_key(x_gemini_key: Optional[str] = None) -> str:
    """Retrieve Gemini API key from request headers or environment variables."""
    # Force reload .env file to pick up hot-edits without server restarts
    load_dotenv(override=True)
    
    if x_gemini_key and x_gemini_key.strip() and x_gemini_key != "undefined":
        return x_gemini_key.strip()
    
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    
    raise HTTPException(
        status_code=400, 
        detail="Gemini API Key is missing. Please set GEMINI_API_KEY in the backend .env or provide it in the UI."
    )

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def color_distance(c1, c2):
    """Calculate Euclidean distance between two RGB colors."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def remove_background_chroma(img: Image.Image, target_rgb=(255, 255, 255), threshold=30) -> Image.Image:
    """
    Convert a solid color background to transparent.
    Supports a threshold tolerance to key out slightly off-white/colored edges.
    """
    img = img.convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # item is (r, g, b, a)
        dist = color_distance(item[:3], target_rgb)
        if dist <= threshold:
            # Linear transparency falloff near threshold or simple cut
            new_data.append((item[0], item[1], item[2], 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    return img

def create_repeated_pattern(
    motif: Image.Image,
    canvas_w: int,
    canvas_h: int,
    scale: float,
    repeat_type: str,
    bg_color: str,
    spacing_x: int,
    spacing_y: int,
    rotation: float
) -> Image.Image:
    """
    Renders the motif onto a canvas repeated horizontally and vertically,
    incorporating scale, rotation, spacing, and specific repeat offset techniques.
    """
    # 1. Prepare Base Canvas
    # Parse hex color or default to transparent
    if bg_color.lower() in ["transparent", "none", ""]:
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    else:
        # Strip '#' if present and convert hex to RGB
        hex_str = bg_color.lstrip('#')
        try:
            rgb = tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
            canvas = Image.new("RGBA", (canvas_w, canvas_h), rgb + (255,))
        except Exception:
            # Fallback to white if hex parsing fails
            canvas = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 255))

    # 2. Process Motif (Rotation & Scaling)
    # Ensure motif has an alpha channel
    motif = motif.convert("RGBA")
    
    # Calculate target dimensions
    orig_w, orig_h = motif.size
    
    # Apply base scale
    target_w = max(10, int(orig_w * scale))
    target_h = max(10, int(orig_h * scale))
    
    # Resize motif
    motif_scaled = motif.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Apply rotation if specified
    if rotation != 0:
        # Rotate with expand=True so we don't clip corners, then transparent background
        motif_scaled = motif_scaled.rotate(rotation, expand=True, resample=Image.Resampling.BICUBIC)
        target_w, target_h = motif_scaled.size

    # Total cell size including spacing
    cell_w = target_w + spacing_x
    cell_h = target_h + spacing_y
    
    # Calculate columns and rows required to cover the canvas (and bleed edges)
    cols = math.ceil(canvas_w / cell_w) + 2
    rows = math.ceil(canvas_h / cell_h) + 2
    
    # Offset starting point to ensure top-left corners are properly bled
    start_x = -cell_w
    start_y = -cell_h

    # 3. Tile the Motif
    for r in range(rows):
        for c in range(cols):
            x = start_x + (c * cell_w)
            y = start_y + (r * cell_h)
            
            # Apply layout offsets based on repeat types
            tile_to_paste = motif_scaled
            
            if repeat_type == "half-drop":
                # Offset every odd column downwards by 50%
                if c % 2 == 1:
                    y += cell_h // 2
                    
            elif repeat_type == "brick":
                # Offset every odd row rightwards by 50%
                if r % 2 == 1:
                    x += cell_w // 2
                    
            elif repeat_type == "mirror":
                # Alternating flip horizontal/vertical
                flip_h = (c % 2 == 1)
                flip_v = (r % 2 == 1)
                if flip_h and flip_v:
                    tile_to_paste = ImageOps.mirror(ImageOps.flip(motif_scaled))
                elif flip_h:
                    tile_to_paste = ImageOps.mirror(motif_scaled)
                elif flip_v:
                    tile_to_paste = ImageOps.flip(motif_scaled)
            
            # Paste onto canvas using the alpha channel as mask for transparent overlays
            canvas.alpha_composite(tile_to_paste, (x, y))
            
    return canvas

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Design Studio: Motif Repeater Backend is running!"}

@app.post("/api/replicate")
async def replicate_motif(
    motif_image: UploadFile = File(...),
    scale: float = Form(1.0),
    repeat_type: str = Form("block"), # block, half-drop, brick, mirror
    background_color: str = Form("#ffffff"), # hex code or transparent
    remove_bg: bool = Form(False),
    bg_threshold: int = Form(30),
    bg_target_r: int = Form(255),
    bg_target_g: int = Form(255),
    bg_target_b: int = Form(255),
    spacing_x: int = Form(0),
    spacing_y: int = Form(0),
    rotation: float = Form(0.0),
    canvas_width: int = Form(1024),
    canvas_height: int = Form(1024),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key")
):
    """
    Multimodal API endpoint for scaling, spacing, filtering and tiling any motif image.
    Uses Google Gemini & Imagen 3 to generate pristine AI textile patterns when an API key is available,
    and falls back to high-performance local Pillow tiling to guarantee 100% reliable, bug-free renders.
    """
    try:
        # 1. Read input image file bytes
        contents = await motif_image.read()
        try:
            motif_img = Image.open(io.BytesIO(contents))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image file uploaded.")
            
        # 2. Check for Gemini API key availability for AI Image Generation
        # Force reload .env to fetch any hotkey edits
        load_dotenv(override=True)
        api_key = None
        try:
            api_key = get_api_key(x_gemini_api_key)
        except Exception:
            logger.info("No Gemini API key available. Proceeding with high-performance local Pillow tiling.")

        if api_key:
            try:
                # Encode input motif to base64
                motif_b64 = base64.b64encode(contents).decode("utf-8")
                motif_mime = motif_image.content_type or "image/png"

                # Define system instruction to synthesize the perfect seamless Imagen prompt
                # Translating technical gaps & rotations into fluid visual style prompts to prevent Imagen from drawing dividing grid borders or lines
                spacing_desc = "densely packed, lush, interlocking edge-to-edge pattern with zero gaps, forming an unbroken, seamless continuous design"
                if spacing_x > 20 or spacing_y > 20:
                    spacing_desc = f"beautifully spaced-out layout where each repeating motif sits gracefully on an elegant, wide field of solid '{background_color}' color, flowing harmoniously without touching"
                
                scale_desc = "delicate, intricate small-scale repeating print"
                if scale > 1.2:
                    scale_desc = "bold, prominent large-scale repeating focal-point design"
                elif scale < 0.4:
                    scale_desc = "ultra-fine, highly dense micro-pattern repeating print"

                rotation_desc = "perfectly upright vertical alignment"
                if rotation != 0:
                    rotation_desc = f"gracefully rotated by {rotation} degrees, creating a dynamic, playful dancing layout"

                system_instruction = (
                    "You are an expert fashion textile director, senior CAD colorist, and masterprint designer specializing in mathematically perfect, seamless tileable fabric replication.\n"
                    "Your task is to write a highly detailed, professional prompt for an AI image generator (Imagen 3) to generate a seamless, continuous, borderless textile pattern of the uploaded motif.\n\n"
                    "You must incorporate these descriptive layout parameters into your prompt:\n"
                    f"- Background base fill color: '{background_color}' (integrate this color seamlessly)\n"
                    f"- Design Repeating density and scale: {scale_desc}\n"
                    f"- Motif Rotation flow: {rotation_desc}\n"
                    f"- Spacing flow: {spacing_desc}\n\n"
                    "CRITICAL MATHEMATICAL QUALITY & ALIGNMENT INSTRUCTIONS:\n"
                    "1. ZERO BREAKS OR OFFSETS: The pattern must align and repeat perfectly without any shifting, offsets, misalignment, or broken visual connections at the tile boundaries. The elements must lock together with absolute mathematical precision across edges.\n"
                    "2. SEAMLESS EDGE JOINTS: The left boundary of the image must flow perfectly into the right boundary, and the top boundary must flow perfectly into the bottom boundary. There must be zero half-cut motifs, zero broken curves, and zero misaligned lines at the borders.\n"
                    "3. NO TECHNICAL LAYOUT WORDS: DO NOT include technical words such as 'pixels', 'px', 'padding', 'grid cells', 'dividing lines', 'borders', 'margins', 'seam lines', or 'cut edges'. Describing borders makes the generator draw lines, which breaks the seamless texture flow!\n"
                    "4. Analyze the design motif's visual elements, motifs, curves, and colors, and describe them in detail.\n"
                    "5. Output ONLY the raw prompt paragraph. Do not include markdown code blocks, introductory text, explanations, or chatter."
                )

                # Synthesize prompt with Gemini
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
                gemini_payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": system_instruction},
                                {"text": "Here is the uploaded design motif element:"},
                                {
                                    "inlineData": {
                                        "mimeType": motif_mime,
                                        "data": motif_b64
                                    }
                                }
                            ]
                        }
                    ],
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600}
                }

                logger.info("Querying Gemini 2.5 Flash to synthesize pattern prompt...")
                gemini_response = requests.post(gemini_url, json=gemini_payload, timeout=15)
                
                if gemini_response.status_code == 200:
                    synthesized_prompt = gemini_response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    logger.info(f"Synthesized Pattern Prompt: {synthesized_prompt}")

                    # Call Google Imagen 3 generateImages API
                    imagen_url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key={api_key}"
                    imagen_payload = {
                        "prompt": (
                            f"A mathematically perfect seamless, 100% tileable continuous repeating fabric pattern of {synthesized_prompt}. "
                            f"The tile boundaries must connect flawlessly with absolute zero misalignment, zero visual offsets, zero pattern displacement, and zero cuts. "
                            f"Left and right edges must align perfectly, top and bottom edges must connect perfectly. "
                            f"The design must be completely continuous, smooth, and borderless, with absolute zero gaps, zero white dividing lines, "
                            f"and zero seam breaks. Each repeating unit locks seamlessly like a jigsaw puzzle to form an unbroken, smooth, unified textile masterprint."
                        ),
                        "numberOfImages": 1,
                        "outputMimeType": "image/png",
                        "aspectRatio": "1:1"
                    }

                    logger.info("Calling Google Imagen 3 generateImages...")
                    imagen_response = requests.post(imagen_url, json=imagen_payload, timeout=25)

                    if imagen_response.status_code == 200:
                        b64_data = imagen_response.json()["generatedImages"][0]["image"]["imageBytes"]
                        logger.info("AI Image Pattern generated successfully via Gemini/Imagen 3!")
                        return {
                            "status": "success",
                            "image": f"data:image/png;base64,{b64_data}",
                            "width": canvas_width,
                            "height": canvas_height,
                            "scale": scale,
                            "repeat_type": repeat_type,
                            "mode": "ai-generated"
                        }
                    else:
                        logger.warning(f"Imagen 3 returned error status {imagen_response.status_code}. Falling back to Pillow engine.")
                else:
                    logger.warning(f"Gemini prompt synthesis returned error status {gemini_response.status_code}. Falling back to Pillow engine.")
            except Exception as ai_err:
                logger.error(f"AI Pattern Generation error: {ai_err}. Falling back to high-fidelity Pillow engine.", exc_info=True)

        # 3. High-Fidelity Local Pillow Tiling Engine (100% Reliable Fallback)
        logger.info("Executing local Pillow tiling engine...")
        
        # Handle optional chroma-key background removal
        if remove_bg:
            target_color = (bg_target_r, bg_target_g, bg_target_b)
            motif_img = remove_background_chroma(motif_img, target_color, bg_threshold)
            
        # Create tiled canvas
        tiled_canvas = create_repeated_pattern(
            motif=motif_img,
            canvas_w=canvas_width,
            canvas_h=canvas_height,
            scale=scale,
            repeat_type=repeat_type.lower().strip(),
            bg_color=background_color,
            spacing_x=spacing_x,
            spacing_y=spacing_y,
            rotation=rotation
        )
        
        # Save output image to buffered stream
        buffered = io.BytesIO()
        tiled_canvas.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        logger.info(f"Replicated motif locally: scale={scale}, type={repeat_type}, bg={background_color}, size={canvas_width}x{canvas_height}")
        
        return {
            "status": "success",
            "image": f"data:image/png;base64,{img_str}",
            "width": canvas_width,
            "height": canvas_height,
            "scale": scale,
            "repeat_type": repeat_type,
            "mode": "pillow-generated"
        }
        
    except Exception as e:
        logger.error(f"Error during motif replication: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

@app.post("/api/ai-tune")
async def ai_tune_parameters(
    motif_image: UploadFile = File(...),
    user_prompt: str = Form(...),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key")
):
    """
    Multimodal Gemini Endpoint.
    Analyzes the user's styling instruction and the motif design elements to
    compute mathematically optimal fabric tiling parameters.
    """
    api_key = get_api_key(x_gemini_api_key)
    
    try:
        # Read uploaded image bytes and base64-encode
        motif_bytes = await motif_image.read()
        motif_b64 = base64.b64encode(motif_bytes).decode("utf-8")
        motif_mime = motif_image.content_type or "image/png"
        
        system_instruction = (
            "You are an expert fashion textile director, apparel designer, and pattern CAD engineer.\n"
            "Your task is to analyze the user's textual layout instructions and the visual style/colors "
            "of their uploaded motif image to calculate precise mathematical parameter variables for tiling.\n\n"
            "You MUST return a JSON object containing the following keys (and nothing else! No markdown formatting, no codeblocks, just a clean JSON string):\n"
            "- scale: a decimal float from 0.05 to 4.0. Choose smaller scale (e.g. 0.1 to 0.4) for dense, tiny, or subtle prints, and larger scale (1.5 to 3.0) for bold accent focal designs.\n"
            "- spacing_x: an integer from 0 to 100 indicating horizontal pixel gaps between repeats.\n"
            "- spacing_y: an integer from 0 to 100 indicating vertical pixel gaps between repeats.\n"
            "- rotation: an integer from 0 to 360 indicating rotation angle for each motif tile.\n"
            "- background_color: a beautiful CSS hex code (e.g., '#fcf8f2', '#1e293b') that coordinates beautifully with the colors of the motif image, or 'transparent'.\n"
            "- remove_bg: a boolean (true/false) indicating if we should activate chroma keying to strip solid backgrounds (like white/black backdrops) from the uploaded motif image.\n"
            "- bg_threshold: an integer from 20 to 80 for color isolation (default 30).\n"
            "- bg_target_r: integer (0-255) for chroma target red channel (usually 255 for white backdrops).\n"
            "- bg_target_g: integer (0-255) for chroma target green channel (usually 255 for white backdrops).\n"
            "- bg_target_b: integer (0-255) for chroma target blue channel (usually 255 for white backdrops).\n"
            "- explanation: a brief creative 1-sentence design note explaining why you chose these settings (e.g. 'We removed the white background and applied a 45° rotation on a sage pastel backdrop to create a modern tropical breeze look.').\n"
        )
        
        # Build multimodal payload for Gemini API
        parts = [
            {"text": system_instruction},
            {"text": f"User Styling Request: {user_prompt}"},
            {"text": "Here is the uploaded design motif:"},
            {
                "inlineData": {
                    "mimeType": motif_mime,
                    "data": motif_b64
                }
            }
        ]
        
        text_model = "gemini-2.5-flash"
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{text_model}:generateContent?key={api_key}"
        
        gemini_payload = {
            "contents": [
                {
                    "parts": parts
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json" # Request direct JSON output
            }
        }
        
        logger.info(f"Calling Gemini model {text_model} for parameter tuning analysis...")
        gemini_response = requests.post(gemini_url, json=gemini_payload, timeout=20)
        
        if gemini_response.status_code == 200:
            gemini_data = gemini_response.json()
            gemini_text = gemini_data["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            logger.info(f"Gemini returned raw text: {gemini_text}")
            
            # Safe JSON parsing
            try:
                parsed_params = json.loads(gemini_text)
                return {
                    "status": "success",
                    "parameters": parsed_params
                }
            except Exception as parse_err:
                logger.error(f"Failed to parse Gemini JSON: {parse_err}")
                raise HTTPException(status_code=500, detail="Gemini output was not valid JSON.")
        else:
            logger.error(f"Gemini returned status code {gemini_response.status_code}: {gemini_response.text}")
            raise HTTPException(status_code=gemini_response.status_code, detail="Gemini API failed to parse prompt.")
            
    except Exception as e:
        logger.error(f"Error calling AI tuning model: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error analyzing with Gemini AI: {str(e)}")
