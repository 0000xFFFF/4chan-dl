# 4chan-dl

[![Python 3.12.5](https://img.shields.io/badge/Python-3.12.5-yellow.svg)](http://www.python.org/download/)

Download files/media (.jpg, .jpeg, .webm, ...) from 4chan.org with their posted filenames.
<br>
If the thread has multiple files with the same posted filename the files will be downloaded with different names.

## Requirements
* beautifulsoup4
* colorama

## Running
```
./4chan-dl "https://boards.4chan.org/XX/thread/XXXXXXX" -d "downloads"
```

## Recommend way to run
Just downloads new files in thread.
```
./4chan-dl "https://boards.4chan.org/XX/thread/XXXXXXX" -d "downloads" -c -s -t 3
```

## Usage
###### ./4chan-dl -h
```
usage: 4chan-dl [-h] [-d directory] [-o] [-s] [-p] [-c] [-f file.txt] [-t num_threads] url

Download media files (.jpg, .jpeg, .webm, ...) from 4chan.org with their posted filenames

positional arguments:
  url                   4chan thread url

options:
  -h, --help            show this help message and exit
  -d directory, --directory directory
                        directory to save files to
  -o, --overwrite       if file exists with the same filename overwrite it
  -s, --skip            if file exists with the same filename skip it
  -p, --postid          download files with post's id rather than posted filename
  -c, --combine         download files with post's id + posted name (postid_postname.ext) (recommended way to download)
  -f file.txt, --filter file.txt
                        urls to ignore stored in file
  -t num_threads, --threads num_threads
                        number of download threads (default: 1)
```
