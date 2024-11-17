#!/usr/bin/env python3
import subprocess
import os
import tempfile
import re
from pathlib import Path

class ImageConverter:
    def __init__(self):

         # see function below for explanations
        self.clean_prompt = 1
        self.special_chars = [" ", ",", ".", ":", ";", "<", ">"]

        # used to figure where to stop when reading the file backwards
        self.identifier = "ASDFG123456789YOUREABIGGUY"

        # which keys to include from the PNG
        self.keys_to_copy = ["promptkey", "parameters"]

        # ffmpeg stuff. lossless=0 for lossy, quality goes up to 100. compression_level goes up to 6.
        self.lossless = "0"
        self.quality = "95"
        self.compression_level = "6"
    
    def clean_string(self, input_str: str) -> str:
        cleaned = input_str
        
        if self.clean_prompt < 1:
            return cleaned
        
        # trim leading and trailing whitespace; ( example, tags   ) -> (example, tags). shouldn't affect generation.
        cleaned = cleaned.strip()
        
        if self.clean_prompt < 2:
            return cleaned
            
        # collapse comma-space-comma patterns; (example,  , tags) -> (example, tags). affects generation.
        cleaned = re.sub(r',\s*,', ',', cleaned)
        
        if self.clean_prompt < 3:
            return cleaned
            
        # ensure space after commas; (example,tags) -> (example, tags). affects generation.
        cleaned = re.sub(r',(\S)', r', \1', cleaned)
        
        if self.clean_prompt < 4:
            return cleaned
            
        # deduplicate characters specified in special_chars; (example,,,tags, <<lora:something:1.0>) -> (example, tags, <lora:something:1.0>). can change results a lot.
        for char in self.special_chars:
            escaped = re.escape(char)
            cleaned = re.sub(f'{escaped}+', char, cleaned)
            
        return cleaned
    
    def extract_metadata(self, image_path: str) -> str:
        metadata_lines = []
        
        for key in self.keys_to_copy:
            try:
                result = subprocess.run(
                    ['exiftool', '-b', f'-PNG:{key}', image_path],
                    capture_output=True,
                    text=True,
                    check=True
                )
                value = result.stdout.strip()
                if value:
                    metadata_lines.append(f"{key}: {value}")
            except subprocess.CalledProcessError:
                continue
                
        return '\n'.join(metadata_lines)
    
    def convert_image(self, input_path: str) -> None:
        input_path = Path(input_path)
        output_path = input_path.with_suffix('.webp')
        
        metadata = self.extract_metadata(str(input_path))
        cleaned_metadata = self.clean_string(metadata)
        
        with tempfile.NamedTemporaryFile(suffix='.webp', delete=False) as temp_file:
            subprocess.run(['ffmpeg', '-y', '-i', str(input_path), '-lossless', self.lossless, '-q:v', self.quality, '-compression_level', self.compression_level, temp_file.name], check=True)
            
            with open(temp_file.name, 'rb') as temp, open(output_path, 'wb') as out:
                out.write(temp.read())
                out.write(b'\n')
                out.write(f"{self.identifier}\n".encode())
                out.write(cleaned_metadata.encode())
                
        os.unlink(temp_file.name)

def check_deps():
    required = ['ffmpeg', 'exiftool']
    missing = []
    
    for program in required:
        if not subprocess.run(['which', program], capture_output=True).returncode == 0:
            missing.append(program)
            
    if missing:
        print(f"Error: Missing required packages: {', '.join(missing)}")
        print("Please install them before running this script.")
        sys.exit(1)

if __name__ == "__main__":
    import sys
    check_deps()
    
    if len(sys.argv) != 2:
        print("Usage: waitbot_convert.py <input_image.png>")
        sys.exit(1)
        
    converter = ImageConverter()
    converter.convert_image(sys.argv[1])
