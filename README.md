# Obsidian Python Scripting

## Summary 

This is a program to quickly allow you to run your own Python scripts from inside Obsidian. To get started enable this plugin, it will create a scripts/python folder inside your designated .obsidian folder. For each script it will add a custom command to the obsidian commands panel.

## Requirements

- Install your preferred version of python and make sure it functions from the command line eg: ```python .obsidian/scripts/python/main.py```
- This plugin works with naked python scripts eg. scripts/python/example.py
- Or you may want a more complicated script, you can have a folder as a script. You just need to have a main.py file inside of a src folder for it to function as a command, otherwise it will not be able to execute. Make sure to structure the scripts/python as follows
<pre>
  plugins
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

   Your resulting plugins folder should have a structure like the following:
  <pre>
    plugins
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
 ## Directions

 - Add your python scripts in the format specified in the requirements section.
 - Once Obsidian starts, your commands will be added to the commands window and can be run as you would like.
