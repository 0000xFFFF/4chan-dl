#!/usr/bin/env python

import sys
import os
import argparse
import requests
from bs4 import BeautifulSoup
import undetected_chromedriver as uc

from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from colorama import Fore, Style

# Argument parsing
parser = argparse.ArgumentParser(description='Download media files from 4chan.org with their posted filenames')
parser.add_argument('url', type=str, help="4chan thread url")
parser.add_argument('-d', '--directory', metavar='directory', default='.', type=str, help="directory to save files to")
parser.add_argument('-s', '--skip', action='store_true', help="if file exists with the same filename skip it (default: overwrite)")
parser.add_argument('-r', '--recursive_skip', action='store_true', help="recursively search for filenames to skip")
parser.add_argument('-p', '--postid', action='store_true', help="download files with post's id rather than posted filename")
parser.add_argument('-c', '--combine', action='store_true', help="download files with post's id + posted name (<postid>_<postname>.<ext>)")
parser.add_argument('-f', '--filter', metavar='file.txt', type=str, help="urls to ignore stored in file")
parser.add_argument('-t', '--threads', metavar='num_threads', type=int, default=1, help="number of download worker threads (default: 1)")
parser.add_argument('-v', '--verbose', action='store_true', help="be more verbose")
parser.add_argument('-g', '--goodargs', action='store_true', help="-crvt 5")
args = parser.parse_args()

if args.goodargs:
    args.combine = True
    args.recursive_skip = True
    args.verbose = True
    args.threads = 5


def log(text, color=""):
    if args.verbose:
        sys.stdout.write(f"{Style.NORMAL}{color}{text}{Style.RESET_ALL}")
        sys.stdout.flush()


def log2(text, color=""):
    sys.stdout.write(f"{Style.NORMAL}{color}{text}{Style.RESET_ALL}")
    sys.stdout.flush()


log(f"{args}\n")


os.makedirs(args.directory, exist_ok=True)

log("Downloading page...\n")

headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36' }
driver = uc.Chrome()
response = driver.get(args.url)
content = driver.page_source
soup = BeautifulSoup(content, 'html.parser')
file_divs = soup.find_all('div', class_='fileText')
n = len(file_divs)
n_str_len = len(str(n))

# (file_url, file_path)
download_list = []
existing_paths = set()
mutex_lock = threading.Lock()

count_renamed   = 0
count_original  = 0
count_filtered  = 0
count_skip      = 0
count_overwrite = 0
count_download  = 0

url_filter_n = 0
if args.filter is not None:
    with open(args.filter, 'r') as file1:
        url_filter = {line.strip() for line in file1.readlines()}
        url_filter_n = len(url_filter)


def get_new_name(file_path, existing_paths):
    num = 1
    original_file_path = file_path
    while file_path in existing_paths:
        num += 1
        file_name, file_extension = os.path.splitext(original_file_path)
        file_path = f"{file_name}_{num}{file_extension}"
    return file_path


log("+==[ Processing page...\n")


for i, file_div in enumerate(file_divs):
    link = file_div.find('a')
    file_url = 'https:' + link['href']

    x = (f"{(i+1)}").rjust(n_str_len)
    log("|-> ")
    log(f"{x}/{n}", f"{Fore.YELLOW}")
    log(" | ")
    log(f"{file_url}", f"{Fore.GREEN}")
    log(" | ")

    # choose file name
    post_id_with_ext = file_url.split('/')[-1]
    file_name_with_ext = post_id_with_ext
    post_name_with_ext = link.text.strip()
    if post_name_with_ext != post_id_with_ext:
        file_name_with_ext = post_name_with_ext
    if link.get('title'):
        title = link['title']
        post_name_with_ext = title
        file_name_with_ext = title
    if args.postid:
        file_name_with_ext = post_id_with_ext

    if args.combine:
        file_name_with_ext = os.path.splitext(post_id_with_ext)[0] + "_" + post_name_with_ext

    file_path = os.path.join(args.directory, file_name_with_ext)

    filtered = False
    if args.filter and file_url in url_filter:
        filtered = True
        count_filtered += 1
        log("filtered", f"{Fore.LIGHTYELLOW_EX}")
        log(" | ")

    elif any(existing_file_path == file_path for _, existing_file_path in download_list):
        file_path = get_new_name(file_path, existing_paths)
        count_renamed += 1
        log("renamed", f"{Fore.LIGHTYELLOW_EX}")
        log("  | ")
    else:
        count_original += 1
        log("original", f"{Fore.BLUE}")
        log(" | ")

    log(f"{file_path}", f"{Fore.MAGENTA}")
    log("\n")

    if filtered:
        continue

    existing_paths.add(file_path)
    download_list.append([file_url, file_path])

download_list_n = len(download_list)

log("|\n")
log(f"|-> total files........: {n}\n")
log(f"|-> filtered urls......: {count_filtered}/{url_filter_n}\n")
log(f"|-> original post names: {count_original}\n")
log(f"|-> renamed post names.: {count_renamed}\n")
log(f"|-> files to download..: {download_list_n}\n")
log("\n")

log2("+==[ Downloading files...\n")


def recursive_search(file_name):
    for root, dirs, files in os.walk(args.directory):
        for file in files:
            if file == file_name:
                return os.path.join(root, file_name)
    return ""


def download_file(i, file_url, file_path):
    global count_skip
    global count_overwrite
    global count_download

    with mutex_lock:
        x = (f"{(i+1)}").rjust(n_str_len)
        log2("|-> ")
        log2(f"{x}/{download_list_n}", f"{Fore.YELLOW}")
        log2(": ")
        log2(f"{file_url}", f"{Fore.GREEN}")
        log2(" -> ")

        if args.recursive_skip:
            found = recursive_search(os.path.basename(file_path))
            if found:
                count_skip += 1
                log2("rskip:", f"{Fore.LIGHTYELLOW_EX}")
                log2(" ")
                log2(f"{found}\n", f"{Fore.MAGENTA}")
                return

        if os.path.isfile(file_path):
            if args.skip:
                count_skip += 1
                log2("skip:", f"{Fore.LIGHTYELLOW_EX}")
                log2(" ")
                log2(f"{file_path}\n", f"{Fore.MAGENTA}")
                return
            else:
                count_overwrite += 1
                log2("overwrite:", f"{Fore.LIGHTRED_EX}")
                log2(" ")
                log2(f"{file_path}\n", f"{Fore.MAGENTA}")

        else:
            log2(f"{file_path}\n", f"{Fore.MAGENTA}")

    file_response = requests.get(file_url, headers=headers)
    with open(file_path, 'wb') as f:
        f.write(file_response.content)

    with mutex_lock:
        count_download += 1


try:
    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        futures = [executor.submit(download_file, i, file_url, file_path) for i, (file_url, file_path) in enumerate(download_list)]
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as exc:
                log(f"Exception occurred: {exc}\n", f"{Fore.RED}")

except KeyboardInterrupt:
    print("\n\n")
    pass

log("|\n")
log(f"|-> downloaded files...: {count_download}\n")
log(f"|-> skipped files......: {count_skip}\n")
log(f"|-> overwritten files..: {count_overwrite}\n")
log("\n")

log("+==[ INFO\n")
log("|+==[ Processing page \n")
log(f"||-> total files........: {n}\n")
log(f"||-> filtered urls......: {count_filtered}/{url_filter_n}\n")
log(f"||-> original post names: {count_original}\n")
log(f"||-> renamed post names.: {count_renamed}\n")
log(f"||-> files to download..: {len(download_list)}\n")
log("|+==[ Downloading files\n")
log(f"||-> downloaded files...: {count_download}\n")
log(f"||-> skipped files......: {count_skip}\n")
log(f"||-> overwritten files..: {count_overwrite}\n")
log("\n")
log("done.\n\n")

driver.quit()
