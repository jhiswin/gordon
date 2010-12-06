(function(){
    var DEFLATE_CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
        DEFLATE_CODE_LENGHT_MAP = [
            [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [1, 11], [1, 13], [1, 15], [1, 17],
            [2, 19], [2, 23], [2, 27], [2, 31], [3, 35], [3, 43], [3, 51], [3, 59], [4, 67], [4, 83], [4, 99],
            [4, 115], [5, 131], [5, 163], [5, 195], [5, 227], [0, 258]
        ],
        DEFLATE_DISTANCE_MAP = [
            [0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [1, 7], [2, 9], [2, 13], [3, 17], [3, 25], [4, 33], [4, 49],
            [5, 65], [5, 97], [6, 129], [6, 193], [7, 257], [7, 385], [8, 513], [8, 769], [9, 1025], [9, 1537],
            [10, 2049], [10, 3073], [11, 4097], [11, 6145], [12, 8193], [12, 12289], [13, 16385], [13, 24577]
        ];
    
    Gordon.Stream = function(data){
        var buff = [],
            t = this,
            i = t.length = data.length;
        t.offset = 0;
        for(var i = 0; data[i]; i++){ buff.push(fromCharCode(data.charCodeAt(i) & 0xff)); }
        t._buffer = buff.join('');
        t._bitBuffer = null;
        t._bitOffset = 8;
    };
    Gordon.Stream.prototype = {
        readByteAt: function(pos){
            return this._buffer.charCodeAt(pos);
        },
        
        readNumber: function(numBytes, bigEnd){
            var t = this,
                val = 0;
            if(bigEnd){
                while(numBytes--){ val = (val << 8) | t.readByteAt(t.offset++); }
            }else{
                var o = t.offset,
                    i = o + numBytes;
                while(i > o){ val = (val << 8) | t.readByteAt(--i); }
                t.offset += numBytes;
            }
            t.align();
            return val;
        },
        
        readSNumber: function(numBytes, bigEnd){
            var val = this.readNumber(numBytes, bigEnd),
                numBits = numBytes * 8;
            if(val >> (numBits - 1)){ val -= Math.pow(2, numBits); }
            return val;
        },
        
        readSI8: function(){
            return this.readSNumber(1);
        },
        
        readSI16: function(bigEnd){
            return this.readSNumber(2, bigEnd);
        },
        
        readSI32: function(bigEnd){
            return this.readSNumber(4, bigEnd);
        },
        
        readUI8: function(){
            return this.readNumber(1);
        },
        
        readUI16: function(bigEnd){
            return this.readNumber(2, bigEnd);
        },
        
        readUI24: function(bigEnd){
            return this.readNumber(3, bigEnd);
        },
        
        readUI32: function(bigEnd){
            return this.readNumber(4, bigEnd);
        },
        
        readFixed: function(){
            return this._readFixedPoint(32, 16);
        },
        
        _readFixedPoint: function(numBits, precision){
            return this.readSB(numBits) * Math.pow(2, -precision);
        },
        
        readFixed8: function(){
            return this._readFixedPoint(16, 8);
        },
        
        readFloat: function(){
            return this._readFloatingPoint(8, 23);
        },
        
        _readFloatingPoint: function(numEBits, numSBits){
            var numBits = 1 + numEBits + numSBits,
                numBytes = numBits / 8,
                t = this,
                val = 0.0;
            if(numBytes > 4){
                var i = Math.ceil(numBytes / 4);
                while(i--){
                    var buff = [],
                        o = t.offset,
                        j = o + (numBytes >= 4 ? 4 : numBytes % 4);
                    while(j > o){
                        buff.push(t.readByteAt(--j));
                        numBytes--;
                        t.offset++;
                    }
                }
                var s = new Gordon.Stream(fromCharCode.apply(String, buff)),
                    sign = s.readUB(1),
                    expo = s.readUB(numEBits),
                    mantis = 0,
                    i = numSBits;
                while(i--){
                    if(s.readBool()){ mantis += Math.pow(2, i); }
                }
            }else{
                var sign = t.readUB(1),
                    expo = t.readUB(numEBits),
                    mantis = t.readUB(numSBits);
            }
            if(sign || expo || mantis){
                var maxExpo = Math.pow(2, numEBits),
                    bias = ~~((maxExpo - 1) / 2),
                    scale = Math.pow(2, numSBits),
                    fract = mantis / scale;
                if(bias){
                    if(bias < maxExpo){ val = Math.pow(2, expo - bias) * (1 + fract); }
                    else if(fract){ val = NaN; }
                    else{ val = Infinity; }
                }else if(fract){ val = Math.pow(2, 1 - bias) * fract; }
                if(NaN != val && sign){ val *= -1; }
            }
            return val;
        },
        
        readFloat16: function(){
            return this._readFloatingPoint(5, 10);
        },
        
        readDouble: function(){
            return this._readFloatingPoint(11, 52);
        },
        
        readEncodedU32: function(){
            var val = 0;
            for(var i = 0; i < 5; i++){
                var num = this.readByteAt(this._offset++);
                val = val | ((num & 0x7f) << (7 * i));
                if(!(num & 0x80)){ break; }
            }
            return val;
        },
        
        readSB: function(numBits){
            var val = this.readUB(numBits);
            if(val >> (numBits - 1)){ val -= Math.pow(2, numBits); }
            return val;
        },
        
        readUB: function(numBits, lsb){
            var t = this,
                val = 0;
            for(var i = 0; i < numBits; i++){
                if(8 == t._bitOffset){
                    t._bitBuffer = t.readUI8();
                    t._bitOffset = 0;
                }
                if(lsb){ val |= (t._bitBuffer & (0x01 << t._bitOffset++) ? 1 : 0) << i; }
                else{ val = (val << 1) | (t._bitBuffer & (0x80 >> t._bitOffset++) ? 1 : 0); }
            }
            return val;
        },
        
        readFB: function(numBits){
            return this._readFixedPoint(numBits, 16);
        },
        
        readString: function(numChars){
            var t = this,
                b = t._buffer;
            if(undefined != numChars){
                var str = b.substr(t.offset, numChars);
                t.offset += numChars;
            }else{
                var chars = [],
                    i = t.length - t.offset;
                while(i--){
                    var code = t.readByteAt(t.offset++);
                    if(code){ chars.push(fromCharCode(code)); }
                    else{ break; }
                }
                var str = chars.join('');
            }
            return str;
        },
        
        readBool: function(numBits){
            return !!this.readUB(numBits || 1);
        },
        
        seek: function(offset, absolute){
            var t = this;
            t.offset = (absolute ? 0 : t.offset) + offset;
            t.align();
            return t;
        },
        
        align: function(){
            this._bitBuffer = null;
            this._bitOffset = 8;
            return this;
        },
        
        readLanguageCode: function(){
            return this.readUI8();
        },
        
        readRGB: function(){
            return {
                red: this.readUI8(),
                green: this.readUI8(),
                blue: this.readUI8()
            };
        },
        
        readRGBA: function(){
            var rgba = this.readRGB();
            rgba.alpha = this.readUI8();
            return rgba;
        },
        
        readARGB: function(){
            var alpha = this.readUI8(),
                rgba = this.readRGB();
            rgba.alpha = alpha;
            return rgba;
        },
        
        readRect: function(){
            var t = this;
                numBits = t.readUB(5),
                rect = {
                    left: t.readSB(numBits),
                    right: t.readSB(numBits),
                    top: t.readSB(numBits),
                    bottom: t.readSB(numBits)
                };
            t.align();
            return rect;
        },
        
        readMatrix: function(){
            var t = this,
                hasScale = t.readBool();
            if(hasScale){
                var numBits = t.readUB(5),
                    scaleX = t.readFB(numBits),
                    scaleY = t.readFB(numBits);
            }else{ var scaleX = scaleY = 1.0; }
            var hasRotation = t.readBool();
            if(hasRotation){
                var numBits = t.readUB(5),
                    skewX = t.readFB(numBits),
                    skewY = t.readFB(numBits);
            }else{ var skewX =  skewY = 0.0; }
            var numBits = t.readUB(5);
                matrix = {
                    scaleX: scaleX, scaleY: scaleY,
                    skewX: skewX, skewY: skewY,
                    moveX: t.readSB(numBits), moveY: t.readSB(numBits)
                };
            t.align();
            return matrix;
        },
        
        readCxform: function(){
            return this._readCxf();
        },
        
        readCxformA: function(){
            return this._readCxf(true);
        },
        
        _readCxf: function(withAlpha){
            var t = this;
                hasAddTerms = t.readBool(),
                hasMultTerms = t.readBool(),
                numBits = t.readUB(4);
            if(hasMultTerms){
                var multR = t.readSB(numBits) / 256,
                    multG = t.readSB(numBits) / 256,
                    multB = t.readSB(numBits) / 256,
                    multA = withAlpha ? t.readSB(numBits) / 256 : 1;
            }else{ var multR = multG = multB = multA = 1; }
            if(hasAddTerms){
                var addR = t.readSB(numBits),
                    addG = t.readSB(numBits),
                    addB = t.readSB(numBits),
                    addA = withAlpha ? t.readSB(numBits) / 256 : 0;
            }else{ var addR = addG = addB = addA = 0; }
            var cxform = {
                multR: multR, multG: multG, multB: multB, multA: multA,
                addR: addR, addG: addG, addB: addB, addA: addA
            }
            t.align();
            return cxform;
        },
        
        decompress: function(){
            var t = this,
                b = t._buffer,
                o = t.offset,
                data = b.substr(0, o) + JSInflate.inflate(b.substring(o + 2));
            t.length = data.length;
            t.offset = o;
            t._buffer = data;
            return t;
        }
    };
})();
