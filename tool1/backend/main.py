import os
import json
import base64
import logging
from typing import List, Optional
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("design_studio")

# Load environment variables
load_dotenv()

app = FastAPI(title="Design Studio API", description="Backend API for the First Render design tool.")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_api_key(x_gemini_key: Optional[str] = None) -> str:
    """Retrieve API key from request headers or environment variables."""
    if x_gemini_key and x_gemini_key.strip() and x_gemini_key != "undefined":
        return x_gemini_key.strip()
    
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    
    raise HTTPException(
        status_code=400, 
        detail="Gemini API Key is missing. Please set GEMINI_API_KEY in the backend .env or provide it in the UI."
    )

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Design Studio Backend is running!"}

@app.post("/api/first-render")
async def first_render(
    sketch_image: UploadFile = File(...),
    sketch_prompt: Optional[str] = Form(None),
    model_name: str = Form("nano banana"),
    ratio: str = Form("1:1"),
    quality: str = Form("Standard"),
    gender: str = Form("Female"),
    fabric_images: List[UploadFile] = File(default=[]),
    fabric_prompts_json: Optional[str] = Form(None),
    num_outputs: int = Form(1),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key")
):
    """
    Main endpoint for "First Render" tool.
    Fuses the sketch image, fabric images, and descriptions using Gemini multimodal,
    then generates a realistic render using Imagen 3.
    """
    # 1. Resolve API key
    api_key = get_api_key(x_gemini_api_key)
    
    try:
        # 2. Read and convert sketch image to base64
        sketch_bytes = await sketch_image.read()
        sketch_b64 = base64.b64encode(sketch_bytes).decode("utf-8")
        sketch_mime = sketch_image.content_type or "image/jpeg"
        
        # 3. Read and convert fabric images and parse prompts
        fabrics_list = []
        fabric_prompts = []
        if fabric_prompts_json:
            try:
                fabric_prompts = json.loads(fabric_prompts_json)
            except Exception as e:
                logger.error(f"Failed to parse fabric prompts JSON: {e}")
        
        for idx, fab_file in enumerate(fabric_images):
            fab_bytes = await fab_file.read()
            fab_b64 = base64.b64encode(fab_bytes).decode("utf-8")
            fab_mime = fab_file.content_type or "image/jpeg"
            
            # Match prompt by index or default. Could be string or dict
            prompt_data = fabric_prompts[idx] if idx < len(fabric_prompts) else ""
            prompt_text = ""
            placements = []
            scale = 1.0
            
            if isinstance(prompt_data, dict):
                prompt_text = prompt_data.get("prompt", "")
                placements = prompt_data.get("placements", [])
                if not placements and prompt_data.get("placement"):
                    placements = [prompt_data.get("placement")]
                scale = prompt_data.get("scale", 1.0)
            else:
                prompt_text = str(prompt_data)
                
            fabrics_list.append({
                "b64": fab_b64,
                "mime": fab_mime,
                "prompt": prompt_text,
                "placements": placements,
                "scale": scale
            })
            
        logger.info(f"Received sketch, model={model_name}, ratio={ratio}, fabrics_count={len(fabrics_list)}")
        
        # Map model name to actual Gemini API model IDs specified by user
        model_mapping = {
            "nano banana 2": "gemini-3.1-flash-image",
            "nano banana 2 lite": "gemini-3.1-flash-lite-image",
            "nano banana pro": "gemini-3-pro-image",
            "nano banana": "gemini-2.5-flash-image",
            "nana banana bro": "gemini-3-pro-image"
        }
        
        # Resolve the model ID. If they pass a raw model ID directly (e.g. "gemini-3.1-flash-image"), use it.
        resolved_model = model_name.strip()
        if resolved_model.lower() in model_mapping:
            resolved_model = model_mapping[resolved_model.lower()]
        elif resolved_model.lower() == "nana banana bro":
            resolved_model = "gemini-3-pro-image"
            
        logger.info(f"Resolved Image model: {resolved_model}")

        # Derive the corresponding text model for generating the prompt (removing "-image" suffix)
        if resolved_model.endswith("-image"):
            text_model = resolved_model.replace("-image", "")
        else:
            text_model = "gemini-2.5-flash"
            
        logger.info(f"Resolved Text model for prompt generation: {text_model}")

        # Map quality value to precise high-fidelity prompt directives
        quality_directives = {
            "1k": "rendered as a high quality vector file with clean sewing lines.",
            "2k": "outstanding 2D technical layout, crisp outer solid stroke lines, high-fidelity pattern fillings.",
            "3k": "ultra-clear masterclass technical flat CAD specification, perfect vector line weight, absolute pattern fill sharpness."
        }
        quality_desc = quality_directives.get(quality.lower().strip(), "clean black outlines and flat fabric pattern fills.")

        # Try to synthesize the prompt using the Gemini text model, fallback to a robust local string builder if it fails
        generated_prompt = ""
        try:
            # System instructions to direct Gemini on how to generate the perfect prompt
            system_instruction = (
                "You are an expert AI fashion director and professional clothing designer specializing exclusively in menswear and men's fashion.\n"
                "Your task is to write a highly detailed, professional prompt for an AI image generator "
                "that renders a clean 2D vector technical flat sketch of a men's garment from a user's sketch silhouette.\n\n"
                "You must integrate the following inputs into your prompt design:\n"
                f"- Model Style Preset: {model_name}.\n"
                "- Style Gender Target: Designed for a Men / Male cut and sizing exclusively (this tool is strictly for men only, ignore other genders if specified).\n"
                f"- Aspect Ratio: Use a {ratio} framing ratio.\n"
                f"- Quality Specification: {quality_desc}\n"
                f"- Garment Silhouette: Analyze the user's sketch image. The final garment MUST strictly follow the structural lines, cuts, silhouette, and design features shown in this sketch, tailored specifically for a male fit.\n"
                f"- User Sketch Description: {sketch_prompt or 'No prompt specified, generate a creative modern fashion design based on the sketch.'}\n"
                "- Fabrics & Textures: Integrate the provided fabric images into specific parts of the garment. Refer to the fabric colors, textures, patterns, and their descriptions to describe exactly which parts of the garment use which fabric (e.g., sleeves are made of fabric 1, bodice is fabric 2, etc.).\n\n"
                "CRITICAL DESIGN CONSTRAINTS:\n"
                "1. STRICT 2D VECTOR FLAT DRAWING / TECHNICAL CAD ILLUSTRATION STYLE: The output image must be a perfectly flat 2D vector technical sketch / CAD design sheet (similar to a digital vector graphic filled flatly with clipping-masked patterns in Adobe Illustrator). It must have clean, crisp, solid black outer stroke lines (outlines). It must have ABSOLUTELY NO 3D volumetric effect, NO 3D body curvature, NO mannequin shadows, NO realistic depth or shadows, NO photorealistic folds, and NO human body parts (no head, face, neck, skin, arms, or legs). It must be an entirely flat, 2D vector design presentation on a plain white background.\n"
                "2. 2D FLAT TEXTURE MAPPING: The fabric patterns, colors, and textures must be filled flatly inside the outlines of their respective panels (pattern fill), without any 3D warp, shading, or realistic folding distortions. The pattern is applied as a clean flat tile.\n"
                "3. Compile all fabrics into a SINGLE, cohesive, flat 2D garment render. For example, if Fabric 1 is mapped to the pockets and Fabric 2 is mapped to the rest of the garment, ensure both are seamlessly merged onto the single final flat garment CAD presentation.\n"
                "4. EXCLUSIVELY MENSWEAR & NO FABRIC ON LOWER GARMENTS (PANTS/TROUSERS/ETC.): Since this tool is built exclusively for men's fashion, always tailor the styling for men. Crucially, IF the user's sketch contains pants, trousers, shorts, bottoms, or any other lower-body garment, DO NOT apply any fabric pattern, texture, or color design to that lower garment/pant. Keep any pants, trousers, shorts, or other bottom clothing pieces completely plain, untextured, and blank (a clean solid neutral color like flat white or light gray) with just black outlines, while applying the fabric/texture ONLY to the main top garment (e.g., jacket, shirt, hoodie, etc.).\n"
                "5. Output ONLY the raw prompt text itself. Do not include any introductory remarks, conversation, explanations, or codeblocks."
            )
            
            # Build Gemini payload parts
            parts = [
                {"text": system_instruction},
                {"text": f"User Sketch Description: {sketch_prompt or 'None'}"},
                {"text": "Here is the user's base garment sketch:"},
                {
                    "inlineData": {
                        "mimeType": sketch_mime,
                        "data": sketch_b64
                    }
                }
            ]
            
            # Add fabric parts
            for i, fab in enumerate(fabrics_list):
                desc_text = f"Fabric #{i+1} Description: {fab['prompt'] or 'Seamless texture'}"
                p_list = fab.get("placements", [])
                if p_list:
                    desc_text += f", Placement target areas on garment: {', '.join(p_list)}"
                if fab.get("scale"):
                    desc_text += f", Texture scale multiplier: {fab['scale']}x"
                parts.append({"text": desc_text})
                parts.append({
                    "inlineData": {
                        "mimeType": fab["mime"],
                        "data": fab["b64"]
                    }
                })
                
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{text_model}:generateContent?key={api_key}"
            gemini_payload = {
                "contents": [
                    {
                        "parts": parts
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 1000
                }
            }
            
            logger.info(f"Calling Gemini text model {text_model} to synthesize prompt...")
            gemini_response = requests.post(gemini_url, json=gemini_payload, timeout=20)
            
            if gemini_response.status_code == 200:
                gemini_data = gemini_response.json()
                generated_prompt = gemini_data["candidates"][0]["content"]["parts"][0]["text"].strip()
                logger.info(f"Synthesized Prompt successfully via API: {generated_prompt}")
            else:
                logger.warning(f"Gemini API returned code {gemini_response.status_code}. Falling back to Python Prompt Builder.")
        except Exception as e:
            logger.error(f"Error calling prompt generation model: {e}. Falling back to Python Prompt Builder.")

        # Fallback local expert-level prompt builder in case text generation is unavailable
        if not generated_prompt:
            style_desc = "elegant high-end menswear runway flat CAD style."
            if "gemini-2.5-flash-image" in resolved_model:
                style_desc = "sleek high-fashion modern men's flat vector style."
            elif "gemini-3-pro-image" in resolved_model:
                style_desc = "cool stylish streetwear men's flat CAD drawing."
            elif "gemini-3.1-flash-lite-image" in resolved_model:
                style_desc = "minimalistic sophisticated clean line men's vector style."

            garment_lines = sketch_prompt.strip() if sketch_prompt and sketch_prompt.strip() else "the beautifully drafted garment outline from the input sketch"
            
            fabric_lines = []
            for i, f in enumerate(fabrics_list):
                p_text = f"on target panels ({', '.join(f.get('placements', []))})" if f.get("placements") else ""
                if f["prompt"]:
                    fabric_lines.append(f"Fabric #{i+1} ({f['prompt']}) {p_text} applied flatly with clipping mask pattern and faithful color reproduction")
                else:
                    fabric_lines.append(f"Fabric #{i+1} texture mapped seamlessly {p_text} as a flat vector tile")
                    
            fab_details = ", ".join(fabric_lines)
            fusing_text = f"The output is a single 2D vector CAD render that beautifully merges these material textures onto their designated flat panels: {fab_details}." if fab_details else ""
            
            # Ensure lower garments / pants / trousers are excluded from fabric application in fallback
            fusing_text += " Crucially, if the sketch includes pants, trousers, or other lower-body garments, do not apply any fabric textures, patterns, or colors to them; keep them completely plain, untextured white or solid gray with clean black outlines."

            generated_prompt = (
                "2D technical CAD flat drawing and vector illustration of a custom men's garment, "
                f"strictly following the shape, structural lines, cuts, and flat silhouette of the sketch. "
                f"Garment style is designed for men's cut: {style_desc}, with details: {garment_lines}. "
                f"Laid completely flat with absolute zero 3D volume, zero body curvature, and zero mannequin shapes. "
                f"Plain white solid background with clean crisp black stroke outlines. NO human body parts, NO face, NO head, NO neck, NO hair, NO eyes, NO arms, NO skin, and NO legs. "
                f"The garment is displayed completely flat, laid out in 2D with absolute flat texture fills and clean seams. "
                f"{fusing_text} Precise technical lines, neat stitching, {quality_desc} "
                f"Aspect ratio is {ratio}."
            )
            logger.info(f"Synthesized Prompt locally: {generated_prompt}")
            
        # 5. Generate the image using dynamic dual-mode logic
        images_list = []
        is_gemini_image_model = "gemini" in resolved_model.lower()
        
        if is_gemini_image_model:
            # Mode A: Call generateContent for native Gemini image generation models
            try:
                logger.info(f"Attempting native Gemini Image Generation for {resolved_model}...")
                gemini_img_url = f"https://generativelanguage.googleapis.com/v1beta/models/{resolved_model}:generateContent?key={api_key}"
                
                # For native Gemini models, run generation sequentially to get multiple variants
                for idx_loop in range(num_outputs):
                    img_payload = {
                        "contents": [
                            {
                                "parts": [
                                    {"text": f"Generate a clean 2D vector CAD technical flat sketch with flat clipping-masked fabric patterns based on this design. Prompt: {generated_prompt}"},
                                    {"text": "Silhouette Sketch Reference:"},
                                    {
                                        "inlineData": {
                                            "mimeType": sketch_mime,
                                            "data": sketch_b64
                                        }
                                    }
                                ]
                            }
                        ],
                        "generationConfig": {
                            "temperature": 0.5 + (0.1 * idx_loop)
                        }
                    }
                    
                    # Feed the fabrics to the image model as well
                    for idx, fab in enumerate(fabrics_list):
                        img_payload["contents"][0]["parts"].extend([
                            {"text": f"Fabric swatch #{idx+1} texture reference:"},
                            {
                                "inlineData": {
                                    "mimeType": fab["mime"],
                                    "data": fab["b64"]
                                }
                            }
                        ])
                        
                    img_response = requests.post(gemini_img_url, json=img_payload, timeout=45)
                    logger.info(f"Gemini image generation response status [loop {idx_loop}]: {img_response.status_code}")
                    
                    if img_response.status_code == 200:
                        res_json = img_response.json()
                        parts = res_json.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                        for part in parts:
                            if "inlineData" in part:
                                mime = part["inlineData"].get("mimeType", "")
                                if mime.startswith("image/"):
                                    single_b64 = part["inlineData"].get("data")
                                    if single_b64:
                                        images_list.append(f"data:image/jpeg;base64,{single_b64}")
                                        logger.info(f"Successfully extracted generated image bytes for loop {idx_loop}!")
                                    break
                    else:
                        logger.warning(f"Native Gemini image generation returned status {img_response.status_code}: {img_response.text}")
                        break
            except Exception as ex:
                logger.error(f"Failed native Gemini image generation: {ex}. Falling back to standard Imagen.")
                
        # Mode B: Call standard Imagen generateImages (or fallback if Gemini image extraction was skipped/failed)
        if not images_list:
            logger.info("Calling standard Imagen generateImages...")
            fallback_model = resolved_model if "imagen" in resolved_model.lower() else "imagen-3.0-generate-002"
            
            imagen_url = f"https://generativelanguage.googleapis.com/v1beta/models/{fallback_model}:generateImages?key={api_key}"
            imagen_payload = {
                "prompt": generated_prompt,
                "numberOfImages": num_outputs,
                "outputMimeType": "image/jpeg",
                "aspectRatio": ratio
            }
            
            logger.info(f"Calling Imagen model '{fallback_model}' with ratio={ratio}, numberOfImages={num_outputs}...")
            imagen_response = requests.post(imagen_url, json=imagen_payload, timeout=45)
            
            if imagen_response.status_code == 200:
                imagen_data = imagen_response.json()
                try:
                    for img_obj in imagen_data.get("generatedImages", []):
                        b64_data = img_obj.get("image", {}).get("imageBytes")
                        if b64_data:
                            images_list.append(f"data:image/jpeg;base64,{b64_data}")
                    logger.info(f"Successfully generated {len(images_list)} render images from fallback Imagen 3!")
                except (KeyError, IndexError) as parse_err:
                    logger.error(f"Failed to parse Imagen output structure: {parse_err}")
            else:
                err_text = imagen_response.text
                logger.error(f"Imagen API returned error status {imagen_response.status_code}: {err_text}")
                raise HTTPException(
                    status_code=imagen_response.status_code,
                    detail=f"Imagen Image Generation failed (Status {imagen_response.status_code}): {err_text}"
                )
                
        if images_list:
            return {
                "success": True,
                "image": images_list[0],
                "images": images_list,
                "prompt": generated_prompt
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate fashion image from all available model endpoints."
            )
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("An unexpected error occurred during rendering")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
