#!/bin/bash
swfdump -D $1 2> /dev/null | gawk -f stat.awk
