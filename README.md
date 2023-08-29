# Obsidian Python Scripter

## Summary 

This is a program to quickly allow you to run your own Python scripts from inside Obsidian. To get started enable this plugin, it will create a scripts/python folder inside your designated .obsidian folder. For each script it will add a custom command to the obsidian commands panel.

## Requirements

- Install your preferred version of python and make sure it functions from the command line eg: ```python .obsidian/scripts/python/main.py```
- This plugin works with naked python scripts eg. scripts/python/example.py
- Or you may want a more complicated script, you can have a folder as a script. You just need to have a main.py file inside of a src folder for it to function as a command, otherwise it will not be able to execute. Make sure to structure the scripts/python as follows
<pre>
  scripts
    |
    ---- python
           |
           ---- example
                  |
                  ---- src
                        |
                        ---- main.py
                        |
                        ---- hello.py
</pre>

   Your resulting scripts folder should have a structure like the following:
  <pre>
  scripts
    | 
    ---- python
           | 
           ---- example 
           |       | 
           |       ---- src 
           |             | 
           |             ---- main.py 
           |             | 
           |             ---- hello.py 
           | 
           ---- example2.py 
</pre>

 ## Obsidian Directions 

 - Add your python scripts in the format specified in the requirements section.
 - Once Obsidian starts, your commands will be added to the commands window and can be run as you would like.
 - In the above example, there would be 2 commands added:
 	- Run example
  	- Run example2.py

![commandwindow](https://github.com/nickrallison/obsidian-python-scripter/assets/99363282/3fcf9fa0-451a-4f55-af9d-ba8d57af92ee)
  
 ## Script Direction

The script passes 2 arguments to the script, argument 1 is the absolute path to the obsidian root folder, argument 2 is the path to the open file if it is open, otherwise an empty path is sent
e.g. ```python \Users\nick\Documents\Vault\.obsidian\scripts\python\main.py \Users\nick\Documents\Vault dir1\file1.md```

These can be used by the script as liked.

Here is a starting point for a python script: main.py

```python
# main.py
import sys
import os

python_script = sys.argv[0]
file_path = sys.argv[2]
vault_path = sys.argv[1]

abs_file_path = os.path.abspath(os.path.join(vault_path, file_path))

print(f"This is the open file: {abs_file_path}")
```

## TODO

- Auto reload when python dir is updated
