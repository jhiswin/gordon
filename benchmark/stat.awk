BEGIN {c=0;d=0;}
/Frame rate:/ {printf "Frame rate: %5.2f\n", $4}
/Frame count:/ {printf "Frame count: %d\n", $4}
/PLACEOBJECT/ {c++;}
/REMOVEOBJECT/ {c++;}
/DEFINE/ {d++;}
END {printf "Define Tags: %d\nControl Tags: %d\n", d, c;}
