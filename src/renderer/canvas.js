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
    t._cached = {};
    
    t.init();
};

Gordon.CanvasRenderer.prototype = {
		
	init: function() {
		var t = this;
	    t._displayList = {};
	    t._clipDepth = 0;
	    t._preserve = false;
	    
	    t._context = [];
	},

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
        switch(type) {
        case 'image':
        	var id = objId({'id':obj.id}),
        		colorData = obj.colorData,
	        	width = obj.width,
        		height = obj.height;
        	if(colorData){
        		var fmt = obj.format;
        		if (fmt == Gordon.bitmapFormats.COLORMAPPED) {
	                var colorTableSize = obj.colorTableSize || 0,
	                    bpp = (obj.withAlpha ? 4 : 3),
	                    cmIdx = colorTableSize * bpp,
	                    data = (new Gordon.Stream(colorData)).unzip(true),
	                    withAlpha = obj.withAlpha,
	                    pxIdx = 0,
	                    canvas = doc.createElement("canvas"),
	                    ctx = canvas.getContext("2d"),
	                    imgData = ctx.createImageData(width, height),
	                    pxData = imgData.data,
	                    pad = colorTableSize ? ((width + 3) & ~3) - width : 0;
	                canvas.width = width;
	                canvas.height = height;
	                for(var y = 0; y < height; y++){
	                    for(var x = 0; x < width; x++){
	                        var idx = (colorTableSize ? data[cmIdx++] : cmIdx) * bpp,
	                            alpha = withAlpha ? data[cmIdx + 3] : 255;
	                        if(alpha){
	                            pxData[pxIdx] = data[idx];
	                            pxData[pxIdx + 1] = data[idx + 1];
	                            pxData[pxIdx + 2] = data[idx + 2];
	                            pxData[pxIdx + 3] = alpha;
	                        }
	                        pxIdx += 4;
	                    }
	                    cmIdx += pad;
	                }
	                ctx.putImageData(imgData, 0, 0);
	                t._cached[id] = canvas;
        		} else if(fmt == Gordon.bitmapFormats.RGB15) {
        			// FIXME: not implemented
        			var img = new Image();
        			t._cached[id] = img;
        		} else if(fmt == Gordon.bitmapFormats.RGB24) {
        			var data = (new Gordon.Stream(colorData)).unzip(true),
        				canvas = doc.createElement('canvas'),
        				ctx = canvas.getContext('2d'),
        				imgData = ctx.createImageData(width, height),
        				pxData = imgData.data,
        				pxIdx = idx = 0;
        			canvas.width = width;
        			canvas.height = height;
        			for(var x = 0; x < width; x++) {
        				for(var y = 0; y < height; y++) {
        					pxData[pxIdx] = data[idx + 1];
        					pxData[pxIdx + 1] = data[idx + 2];
        					pxData[pxIdx + 2] = data[idx + 3];
        					pxData[pxIdx + 3] = 255;
        					pxIdx += 4;
        					idx += 4;
        				}
        			}
        			ctx.putImageData(imgData, 0, 0);
        			t._cached[id] = canvas;
        		}
            } else {
	        	var	alphaData = obj.alphaData,
	            	uri = "data:image/jpeg;base64," + btoa(obj.data);
		        if(alphaData){
		            var img = new Image(),
		                canvas = doc.createElement("canvas");

		            canvas.width = width;
		            canvas.height = height;
		            img.onload = function() {
		            	var ctx = canvas.getContext("2d"),
		            		len = width * height,
		            		data = (new Gordon.Stream(alphaData)).unzip(true);
		            	ctx.drawImage(img, 0, 0);
			            var imgData = ctx.getImageData(0, 0, width, height),
			                pxData = imgData.data,
			                pxIdx = 0;
			            for(var i = 0; i < len; i++){
			                pxData[pxIdx + 3] = data[i];
			                pxIdx += 4;
			            }
			            ctx.putImageData(imgData, 0, 0);
		            };
		            img.src = uri;
		            t._cached[id] = canvas;
		        } else {
		        	var img = new Image();
		        	img.src = uri;
		        	t._cached[id] = img;
		        }
        	}
        	break;
        case 'morph':
        	break;
        }
        return t;
    },
    
    _patch: function(obj, diff, ratio) {
    	if(!diff || !ratio) return obj;
    	var dist = {};
    	for(var i in obj) {
    		if(obj.hasOwnProperty(i)) {
    			dist[i] = obj[i] + diff[i] * ratio;
    		}
    	}
    	return dist;
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
            fd = frm ? frm.displayList : {},
            ctx = t._ctx;
        if(!t._preserve) {
	        ctx.clearRect(0, 0, t.width, t.height);
	        ctx.save();
	        ctx.setTransform(t.scaleX, 0, 0, t.scaleY, t.moveX, t.moveY);
        }

        t._updateDisplayList(d, fd);
        
        for(var depth in d) {
            var character = d[depth];
            if (character) {
                t.place(character);
            }
        }
        
        // in case of the last clipped character is removed 
        if (t._clipDepth) {
            t._clipDepth = 0;
            ctx.restore();
        }
        
        if (!t._preserve) {
        	ctx.restore();
        }
        return t;
    },

    _updateDisplayList: function(d, fd) {
    	
        for(var depth in fd){
        	var oldChar = d[depth],
        		newChar = fd[depth],
        		update = oldChar && newChar && !newChar.object;
        	
            if (update) { // update character
                for(var p in newChar) {
                    oldChar[p] = newChar[p];
                }
            } else {	// replace character
            	d[depth] = oldChar = {};
                for(var p in newChar) {
                    oldChar[p] = newChar[p];
                }
            }
        }
        
    },

    place: function(character) {
        var t = this,
        	c = t._ctx,
            def = t._dictionary[character.object];
        if (def) {
            if (def.type == 'shape') {
                t._renderShape(c, def, character);
            } else if (def.type == 'text') {
                t._renderText(c, def, character);
            } else if (def.type == 'sprite') {
            	t._renderSprite(c, def, character);
            } else {
                console.warn(def.type);
                console.info(def);
            }
        }
        return t;
    },

    _renderShape: function(ctx, def, character) {
        var t = this,
            cxform = character.cxform,
            segments = def.segments || [def],
            clip = character.clipDepth;

        t._prepare(ctx, character);
        for(var j = 0, seg = segments[0]; seg; seg = segments[++j]) {
            var records = seg.records,
                fill = seg.fill,
                line = seg.line;
            ctx.beginPath();
            var firstEdge = records[0],
                x1 = 0,
                y1 = 0,
                x2 = 0,
                y2 = 0;
            for(var i = 0, edge = firstEdge; edge; edge = records[++i]){
                x1 = edge.x1;
                y1 = edge.y1;
                if(x1 != x2 || y1 != y2 || !i){ ctx.moveTo(x1, y1); }
                x2 = edge.x2;
                y2 = edge.y2;
                if(null == edge.cx || null == edge.cy){
                    ctx.lineTo(x2, y2);
                }else{
                    ctx.quadraticCurveTo(edge.cx, edge.cy, x2, y2);
                }
            }
    
            if(!line && (x2 != firstEdge.x1 || y2 != firstEdge.y1)){
                ctx.closePath();
            }

            if(!clip) {
                if (fill) {
                    this._fillShape(ctx, fill, cxform);
                }
        
                if (line) {
                    this._strokeShape(ctx, line, cxform);
                }
            }
        }
        t._postpare(ctx, character);

        if(clip) {
            ctx.save();
            ctx.clip();
            t._clipDepth = clip;
        }

        if(t._clipDepth && t._clipDepth <= character.depth) {
            ctx.restore();
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
    _buildFill: function(ctx, g, cxform) {
        var type = g.type;
        if (type) {
            var fill = ctx.fillStyle;
            switch(type) {
                case 'linear':
                case 'radial':
                    var stops = g.stops;
                    if("linear" == type){
                        var gradient = ctx.createLinearGradient(-819.2, 0, 819.2, 0);
                    }else{
                        var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 819.2);
                    }
                    for(var i in stops) {
                        var color = stops[i].color;
                        if (cxform) {
                            color = transformColor(color, cxform);
                        }
                        gradient.addColorStop(stops[i].offset, color2string(color));
                    }
                    fill = gradient;
                    break;
                case 'pattern':
                	var img = this._cached[objId({'id':g.image.id})];
                    if (cxform) {
                        var id = objId({'id':g.image.id, 'cxform':cxform}),
                            canvas = this._cached[id];
                        if (!canvas) {
                            canvas = doc.createElement('canvas');
                            var ctx2 = canvas.getContext('2d');
                            canvas.width = g.image.width;
                            canvas.height = g.image.height;
                            ctx2.drawImage(img, 0, 0);
                            var data = ctx2.getImageData(0, 0, canvas.width, canvas.height);
                            transformColorArray(data.data, cxform);
                            ctx2.putImageData(data, 0, 0);
                            this._cached[id] = canvas;
                        }
                        img = canvas;
                    }
                   
                    fill = ctx.createPattern(img, g.repeat ? 'repeat':'no-repeat');
                	break;
            }
            return fill;
        } else {
            if (cxform) {
                g = transformColor(g, cxform);
            }
            return color2string(g);
        }
    },
    _fillShape: function(ctx, fill, cxform) {
        var m = fill.matrix;
        ctx.save();
        if (m) {
            ctx.transform(m.scaleX, m.skewX, m.skewY, m.scaleY, m.moveX, m.moveY);
        }
        ctx.fillStyle = this._buildFill(ctx, fill, cxform);
        ctx.fill();
        ctx.restore();
    },
    _strokeShape: function(ctx, stroke, cxform) {
        var t = this,
            m = stroke.matrix;
        ctx.save();
        if (m) {
            ctx.transform(m.scaleX, m.skewY, m.skewX, m.scaleY, m.moveX, m.moveY);
        }
        ctx.strokeStyle = t._buildFill(ctx, stroke.color, cxform);
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
      		t._renderStringStd(c, string);
        }
        t._postpare(c, o);
    },
    _renderStringStd: function(ctx, string) {
    	var t = this,
    		c = ctx,
    		entries = string.entries,
    		fill = string.fill,
    		scale = string.size / 1024,
    		font = t._dictionary[string.font],
    		glyphs = font.glyphs,
    		info = font.info,
            x = string.x, y = string.y;
    	
    	for(var j = 0, entry = entries[0]; entry; entry = entries[++j]) {
    		var index = entry.index,
    			g = glyphs[index],
    			paths = g.paths;
    		c.save();
    		c.translate(x, y);
    		c.scale(scale, scale);
    		c.beginPath();
    		for(var i = 0, path = paths[0]; path; path = paths[++i]) {
    			switch(path.type) {
    			case 'M':
    				c.moveTo(path.x, path.y);
    				break;
    			case 'L':
    			case 'V':
    			case 'H':
    				c.lineTo(path.x, path.y);
    				break;
    			case 'Q':
    				c.quadraticCurveTo(path.cx, path.cy, path.x, path.y);
    				break;
    			}
    		}
    		c.closePath();
    		if(fill) {
    			c.fillStyle = t._buildFill(c, fill, null);
        		c.fill();
    		}
    		c.restore();
    		x += entry.advance;
    	}
    },
	
	_contextKeys: ['_timeline', '_displayList', '_clipDepth', '_preserve'],
	
	saveContext: function(newContext) {
		var t = this,
			context = {};
		for(var i in t._contextKeys) {
			var key = t._contextKeys[i];
			context[key] = t[key];
			t[key] = newContext[key];
		}
		t._context.push(context);
	},
	
	restoreContext: function() {
		var t = this,
			context = t._context.pop();
		for(var i in t._contextKeys) {
			t[i] = context[t._contextKeys[i]];
		}
	},
	
	_renderSprite: function(ctx, def, sprite) {
		if(!sprite.context) {
			sprite.context = {
				_timeline: def.timeline,
				_displayList: {},
				_clipDepth: 0,
				_preserve: true
			};
			sprite.frmIdx = 0;
		}
		var m = sprite.matrix;
    	this.saveContext(sprite.context);
    	ctx.save();
    	if (m) {
    		ctx.transform(m.scaleX, m.skewX, m.skewY, m.scaleY, m.moveX, m.moveY);
    	}
    	this.show(sprite.frmIdx++);
    	ctx.restore();
    	this.restoreContext();
    }
};

var REGEXP_IS_COLOR = /^([\da-f]{1,2}){3}$/i;

function color2string(color){
    if("string" == typeof color){ return REGEXP_IS_COLOR.test(color) ? color : null; }
    if (color.alpha == undefined) {
        return "rgb(" + [color.red, color.green, color.blue] + ')';
    } else {
        return "rgba(" + [color.red, color.green, color.blue, color.alpha / 255] + ')';
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

function transformColorArray(colorArray, cxform){
	var multR = cxform.multR, multG = cxform.multG, multB = cxform.multB, multA = cxform.multA,
		addR = cxform.addR, addG = cxform.addG, addB = cxform.addB, addA = cxform.addA;
	for(var i = 0, length = colorArray.length; i < length; i += 4) {
		colorArray[i] = ~~max(0, min((colorArray[i] * multR) + addR, 255));
		colorArray[i + 1] = ~~max(0, min((colorArray[i + 1] * multG) + addG, 255));
		colorArray[i + 2] = ~~max(0, min((colorArray[i + 2] * multB) + addB, 255));
		colorArray[i + 3] = ~~max(0, min((colorArray[i + 3] * multA) + addA, 255));
	}

	return colorArray;
}

function transformPoint(matrix, p) {
    return [matrix.scaleX * p[0] + matrix.skewX * p[1] + matrix.moveX, matrix.skewY * p[0] + matrix.scaleY * p[1] + matrix.moveY];
}

function objId(obj) {
    return JSON.stringify(obj);
}

})();
