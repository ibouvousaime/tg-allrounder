import asyncio
import json
import os
import shutil
import tempfile
import uuid
from typing import List, Annotated, Optional

import scipy
import torch
from fastapi import FastAPI, BackgroundTasks, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ValidationError, parse_obj_as
from transformers import AutoProcessor, BarkModel

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

print("Loading Bark model...")
processor = AutoProcessor.from_pretrained("suno/bark")
model = BarkModel.from_pretrained("suno/bark").to(device)
print("Bark model loaded successfully.")

class ConversationPart(BaseModel):
    """Defines the structure for a single part of the conversation."""
    speaker: Optional[str] = None  
    text: str
    voice: str = Field(
        default="v2/en_speaker_6",
        description="Voice preset for this part of the conversation.",
        examples=["v2/en_speaker_6", "v2/de_speaker_3"]
    )

app = FastAPI(
    title="Conversational Audio API",
    description="An API to generate audio from a sequence of text and voices using Suno's Bark model.",
)

async def run_blocking_tts(text: str, voice_preset: str, output_path: str):
    """
    A wrapper to run the synchronous, CPU/GPU-bound text-to-speech model
    in a separate thread to avoid blocking the main application.
    """
    def _generate_audio():

        inputs = processor(text, voice_preset=voice_preset, return_tensors="pt").to(device)

        audio_array = model.generate(**inputs, do_sample=True, fine_temperature=0.4, coarse_temperature=0.8)
        audio_array = audio_array.cpu().numpy().squeeze()

        sample_rate = model.generation_config.sample_rate
        scipy.io.wavfile.write(output_path, rate=sample_rate, data=audio_array)

    await asyncio.to_thread(_generate_audio)
    print(f"Generated audio clip: {output_path}")

async def merge_audio_clips(clip_paths: List[str], final_output_path: str):
    """
    Merges multiple audio clips into a single file using ffmpeg.
    """

    inputs = []
    for clip in clip_paths:
        inputs.extend(["-i", clip])

    filter_complex = "".join([f"[{i}:a]" for i in range(len(clip_paths))]) + f"concat=n={len(clip_paths)}:v=0:a=1[out]"

    command = [
        "ffmpeg",
        "-y",  
        *inputs,
        "-filter_complex",
        filter_complex,
        "-map",
        "[out]",
        final_output_path,
    ]

    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        print(f"Error merging files with ffmpeg: {stderr.decode()}")
        raise RuntimeError("Failed to merge audio files.")
    print(f"Successfully merged {len(clip_paths)} clips into {final_output_path}")

@app.post("/create-conversation-audio/", response_class=FileResponse)
async def create_conversation_audio(
    background_tasks: BackgroundTasks,
    conversation_json: Annotated[str, Form(description="A JSON string of the conversation array.")],
    output_filename: Annotated[str, Form()] = "conversation.wav"
):
    """
    Generates audio for a conversation, merges the clips, and returns the final file.

    This endpoint expects multipart/form-data with two fields:
    - `conversation_json`: A string containing a JSON array of conversation parts.
      Example: `[{"text": "Hello there.", "voice": "v2/en_speaker_6"}, {"text": "General Kenobi!", "voice": "v2/en_speaker_9"}]`
    - `output_filename`: The desired name for the output audio file.
    """
    temp_dir = tempfile.mkdtemp(prefix="temp-audio-")
    print(f"Created temporary directory: {temp_dir}")

    try:

        try:
            conversation_data = json.loads(conversation_json)
            conversation = parse_obj_as(List[ConversationPart], conversation_data)
        except (json.JSONDecodeError, ValidationError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid 'conversation_json' format: {e}")

        generation_tasks = []
        clip_paths = []
        for i, part in enumerate(conversation):
            clip_path = os.path.join(temp_dir, f"output-{i}.wav")
            clip_paths.append(clip_path)
            task = run_blocking_tts(part.text, part.voice, clip_path)
            generation_tasks.append(task)

        await asyncio.gather(*generation_tasks)

        final_output_path = os.path.join(temp_dir, output_filename)
        await merge_audio_clips(clip_paths, final_output_path)

        #background_tasks.add_task(shutil.rmtree, temp_dir)

        return FileResponse(
            path=final_output_path,
            media_type="audio/wav",
            filename=output_filename
        )

    except Exception as e:

        print(f"An error occurred: {e}")
        #shutil.rmtree(temp_dir)
        raise e

