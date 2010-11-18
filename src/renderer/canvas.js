/* TODO */
/*
 * Canvas Renderer
 *
 * @author Cong Liu <cong.liu@intel.com>
 */

(function(){

Gordon.CanvasRenderer = function(width, height, frmSize, quality, scale, bgcolor) {
    var t = this,
        n = t.node = doc.createElement('canvas'),
        ctx = t._ctx = n.getContext('2d');
        t.frmWidth = frmWidth = frmSize.right - frmSize.left,
        t.frmHeight = frmHeight = frmSize.bottom - frmSize.top,
        s = Gordon.scaleValues;
    t.width = n.width = width;
    t.height = n.height = height;
    t.frmSize = frmSize;
    t.quality = quality || Gordon.qualityValues.HIGH;
    t.scale = scale || Gordon.scaleValues.SHOW_ALL;
    switch(t.scale) {
        case s.EXACT_FIT:
            t.scaleX = width / frmWidth;
            t.scaleY = height / frmHeight;
            break;
        case s.SHOW_ALL:
        default:
            t.scaleX = t.scaleY = min(width / frmWidth, height / frmHeight);
            break;
    }
    t.moveX = -frmSize.left + (width - t.scaleX * frmWidth) / 2;
    t.moveY = -frmSize.top + (height - t.scaleY * frmHeight) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    t.bgcolor = bgcolor;
    t.setQuality(t.quality);
    if(bgcolor){ t.setBgcolor(bgcolor); }

    /* Create stylesheet */
    var cssNode = doc.createElement('style');
    cssNode.type = 'text/css';
    cssNode.rel = 'stylesheet';
    cssNode.media = 'screen';
    cssNode.title = 'dynamicSheet';
    doc.getElementsByTagName("head")[0].appendChild(cssNode);
    t._stylesheet = doc.styleSheets[doc.styleSheets.length - 1];

    t._dictionary = {};
    t._timeline = [];
    t._displayList = {};
    t._cached = {};
    
};

Gordon.CanvasRenderer.prototype = {

    setQuality: function(q) {
        // IGNORE
        return this;
    },

    setBgcolor: function(rgb) {
        var t = this;
        if(!t.bgcolor){
            t.node.style.background = color2string(rgb);
            t.bgcolor = rgb;
        }
        return t;
    },

    define: function(obj) {
        var t = this,
            d = t._dictionary,
            id = obj.id,
            type = obj.type;

        d[id] = obj;
        if (type == 'font') {
            var info = obj.info,
                glyphs = obj.glyphs,
                codes = info.codes;
                kerningTable = info.kerningTable,
                advanceTable = info.advanceTable;

            var font_svg = '<?xml version="1.0" standalone="yes"?>'+
'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" >'+
'<svg xmlns="http://www.w3.org/2000/svg"><defs>'+
'<font horiz-adv-x="'+(advanceTable ? '' + advanceTable : 1024)+'" >'+
'<font-face units-per-em="1024" ascent="'+(info.ascent || 1024)+'" descent="'+(info.descent || 1024)+'" />';
            for(var i = 0, glyph = glyphs[0]; glyph; glyph = glyphs[++i]) {
                var cmds = glyph.commands,
                    code = codes[i];
                if(cmds && code) {
                    font_svg += '<glyph unicode="&#x'+code.toString(16)+';" d="'+cmds+'z"/>';
                }
            }
            if(kerningTable) {
                for(var i = 0, kern = kerningTable[0]; kern; kern = kerningTable[++i]) {
                    font_svg += '<hkern g1="'+kern.code1+'" g2="'+kern.code2+'" k="'+kern.adjustment+'"/>';
                }
            }
            font_svg += '</font>'+
'</defs></svg>';
            console.info(font_svg);
            t._stylesheet.insertRule('@font-face {font-family: "f'+id+'"; src: url("data:font/svg;base64,'+btoa(font_svg)+'") format("svg")}', 0);
        }
        return t;
    },

    frame: function(frm) {
        var bgcolor = frm.bgcolor,
            t = this;
        if(bgcolor && !t.bgcolor){
            t.setBgcolor(bgcolor);
            t.bgcolor = bgcolor;
        }
        t._timeline.push(frm);
        return t;
    },

    show: function(frmIdx) {
        var t = this,
            frm = t._timeline[frmIdx],
            d = t._displayList,
            fd = frm.displayList,
            ctx = t._ctx;
        ctx.clearRect(0, 0, t.width, t.height);
        ctx.save();
        ctx.setTransform(t.scaleX, 0, 0, t.scaleY, t.moveX, t.moveY);
        for(var depth in fd){
            if (d[depth] && fd[depth] && !fd[depth].object) {
                for(var p in fd[depth]) {
                    d[depth][p] = fd[depth][p];
                }
            } else {
                d[depth] = fd[depth];
            }
        }
        for(var depth in d) {
            var character = d[depth];
            if (character) {
                t.place(character);
            }
        }
        if (t._clipDepth) {
            t._clipDepth = 0;
            ctx.restore();
        }
        ctx.restore();
        return t;
    },

    place: function(character) {
        var t = this,
            def = t._dictionary[character.object];
        if (def) {
            if (def.type == 'shape') {
                this._renderShape(this._ctx, def, character);
            } else if (def.type == 'text') {
                this._renderText(this._ctx, def, character);
            } else {
                console.warn(def.type);
            }
        }
        return this;
    },

    _renderShape: function(ctx, def, character) {
        var t = this,
            c = ctx,
            o = character,
            cxform = o.cxform,
            segments = def.segments || [def],
            clip = o.clipDepth;

        t._prepare(c, o);
        for(var j in segments) {
            var seg = segments[j],
                edges = seg.edges,
                fill = seg.fill,
                line = seg.line;
            c.beginPath();
            var firstEdge = edges[0],
                x1 = 0,
                y1 = 0,
                x2 = 0,
                y2 = 0;
            for(var i = 0, edge = firstEdge; edge; edge = edges[++i]){
                x1 = edge.x1;
                y1 = edge.y1;
                if(x1 != x2 || y1 != y2 || !i){ c.moveTo(x1, y1); }
                x2 = edge.x2;
                y2 = edge.y2;
                if(null == edge.cx || null == edge.cy){
                    c.lineTo(x2, y2);
                }else{
                    c.quadraticCurveTo(edge.cx, edge.cy, x2, y2);
                }
            }
    
            if(!line && (x2 != firstEdge.x1 || y2 != firstEdge.y1)){
                c.lineTo(firstEdge.x1, firstEdge.y1);
            }

            if(!clip) {
                if (fill) {
                    this._fillShape(c, fill, cxform, o);
                }
        
                if (line) {
                    this._strokeShape(c, line, cxform);
                }
            }
        }

        t._postpare(c, o);

        if(clip) {
            c.save();
            c.clip();
            t._clipDepth = clip;
        }

        if(t._clipDepth && t._clipDepth <= o.depth) {
            c.restore();
            t._clipDepth = 0;
        }
    },
    _prepare: function(ctx, character) {
        var m = character.matrix;
        ctx.save();
        if (m) {
            ctx.transform(m.scaleX, m.skewX, m.skewY, m.scaleY, m.moveX, m.moveY);
        }
    },
    _postpare: function(ctx, character) {
        ctx.restore();
    },
    _getGradient: function(ctx, g, cxform) {
        var type = g.type,
            stops = g.stops;
        if (type) {
            var gradient = 'rgba(255,255,255, 0)';
            switch(type) {
                case 'linear':
                case 'radial':
                    if("linear" == type){
                        gradient = ctx.createLinearGradient(-819.2, 0, 819.2, 0);
                    }else{
                        gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 819.2);
                    }
                    for(var i in stops) {
                        var color = stops[i].color;
                        if (cxform) {
                            color = transformColor(color, cxform);
                        }
                        gradient.addColorStop(stops[i].offset, color2string(color));
                    }
                    break;
            }
            return gradient;
        } else {
            if (cxform) {
                g = transformColor(g, cxform);
            }
            return color2string(g);
        }
    },
    _fillShape: function(ctx, fill, cxform, character) {
        var t = this,
            o = character,
            m = fill.matrix;
        ctx.save();
        if (m) {
            ctx.transform(m.scaleX, m.skewX, m.skewY, m.scaleY, m.moveX, m.moveY);
        }
        ctx.fillStyle = t._getGradient(ctx, fill, cxform);
        ctx.fill();
        if(fill.type && fill.type == 'pattern') {
            if (!fill.image.img) {
                var img = doc.createElement('img');
                img.src = "data:image/jpeg;base64," + btoa(fill.image.data);
                fill.image.img = img;
            }
            if (cxform) {
                var id = objId({'id':o.id, 'cxform':cxform}),
                    canvas = t._cached[id];
                if (!canvas) {
                    canvas = doc.createElement('canvas');
                    var ctx2 = canvas.getContext('2d');
                    canvas.width = fill.image.width;
                    canvas.height = fill.image.height;
                    ctx2.drawImage(fill.image.img, 0, 0);
                    var data = ctx2.getImageData(0, 0, canvas.width, canvas.height);
                    var pixels = data.data;
                    for(var i = 0; i < pixels.length; i+=4) {
                        var color = transformColor({
                            red: pixels[i],
                            green: pixels[i+1],
                            blue: pixels[i+2],
                            alpha: pixels[i+3]
                        }, cxform);
                        pixels[i] = color.red;
                        pixels[i+1] = color.green;
                        pixels[i+2] = color.blue;
                        pixels[i+3] = color.alpha;
                    }
                    ctx2.putImageData(data, 0, 0);
                    t._cached[id] = canvas;
                }
                ctx.drawImage(canvas, 0, 0);
            } else {
                ctx.drawImage(fill.image.img, 0, 0);
            }
        }
        ctx.restore();
    },
    _strokeShape: function(ctx, stroke, cxform) {
        var t = this,
            m = stroke.matrix;
        ctx.save();
        if (m) {
            ctx.transform(m.scaleX, m.skewY, m.skewX, m.scaleY, m.moveX, m.moveY);
        }
        ctx.strokeStyle = t._getGradient(ctx, stroke.color, cxform);
        ctx.lineWidth = max(stroke.width, 20);
        ctx.stroke();
        ctx.restore();
    },
    _renderText: function(ctx, def, character) {
        var t = this,
            c = ctx,
            d = def,
            o = character,
            strings = def.strings;

        t._prepare(c, o);
        for(var i = 0, string = strings[0]; string; string = strings[++i]) {
            t._renderString(c, string);
        }
        t._postpare(c, o);
    },
    _renderString: function(ctx, string) {
        var t = this,
            c = ctx,
            entries = string.entries,
            fill = string.fill,
            font = t._dictionary[string.font],
            glyphs = font.glyphs,
            info = font.info,
            codes = info.codes,
            x = string.x, y = string.y;
        t._prepare(c, string);
        for(var j = 0, entry = entries[0]; entry; entry = entries[++j]) {
            var str = String.fromCharCode(codes[entry.index]);
            if(' ' != str || chars.length) {
                c.font = string.size + 'px f' + font.id;
                if(fill) {
                    c.fillStyle = t._getGradient(c, fill, null);
                }
                c.fillText(str, x, y);
            }
            x += entry.advance;
        }
        t._postpare(c, string);
    }
};

var REGEXP_IS_COLOR = /^([\da-f]{1,2}){3}$/i;

function color2string(color){
    if("string" == typeof color){ return REGEXP_IS_COLOR.test(color) ? color : null; }
    if (color.alpha == undefined) {
        return "rgb(" + [color.red, color.green, color.blue] + ')';
    } else {
        return "rgba(" + [color.red, color.green, color.blue, color.alpha] + ')';
    }
}

function transformColor(color, cxform){
    return {
        red: ~~max(0, min((color.red * cxform.multR) + cxform.addR, 255)),
        green: ~~max(0, min((color.green * cxform.multG) + cxform.addG, 255)),
        blue: ~~max(0, min((color.blue * cxform.multB) + cxform.addB, 255)),
        alpha: ~~max(0, min(((color.alpha == undefined ? 255: color.alpha) * cxform.multA) + cxform.addA, 255))
    };
}

function transformPoint(matrix, p) {
    return [matrix.scaleX * p[0] + matrix.skewX * p[1] + matrix.moveX, matrix.skewY * p[0] + matrix.scaleY * p[1] + matrix.moveY];
}

function objId(obj) {
    return JSON.stringify(obj);
}

})();
