# 4chan-dl

[![Python 3.12.5](https://img.shields.io/badge/Python-3.12.5-yellow.svg)](http://www.python.org/download/)

Download files/media (.jpg, .jpeg, .webm, ...) from 4chan.org with their posted filenames

## Requirements
* BeautifulSoup

## Running
```
./4chan-dl "https://boards.4chan.org/XX/thread/XXXXXXX" -d "downloads"
```

## Usage
###### ./4chan-dl -h
```
usage: 4chan-dl [-h] [-d directory] [-o] [-s] [-p] url

Download media (.jpg, .jpeg, .webm, ...) from 4chan.org with their posted filenames

positional arguments:
  url                   4chan thread url

options:
  -h, --help            show this help message and exit
  -d directory, --directory directory
                        directory to save files to
  -o, --overwrite       if file exists with the same filename overwrite it
  -s, --skip            if file exists with the same filename skip it
  -p, --postid          download file with post's id rather than posted filename
```
