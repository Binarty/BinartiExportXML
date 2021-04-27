// ========================================================================
//  XML.ObjTree -- XML source code from/to JavaScript object like E4X
// ========================================================================

if (typeof (XML) == 'undefined') XML = function () { };

//  constructor
XML.ObjTree = function () {
    return this;
};

//  class variables
XML.ObjTree.VERSION = "0.24";
XML.ObjTree.prototype.xmlDecl = '<?xml version="1.0" encoding="UTF-8" ?>\n';
XML.ObjTree.prototype.attr_prefix = '-';
XML.ObjTree.prototype.overrideMimeType = 'text/xml';

XML.ObjTree.prototype.parseXML = function (xml) {
    var root;
    if (window.DOMParser) {
        var xmldom = new DOMParser();
        var dom = xmldom.parseFromString(xml, "application/xml");
        if (!dom) return;
        root = dom.documentElement;
    } else if (window.ActiveXObject) {
        xmldom = new ActiveXObject('Microsoft.XMLDOM');
        xmldom.async = false;
        xmldom.loadXML(xml);
        root = xmldom.documentElement;
    }
    if (!root) return;
    return this.parseDOM(root);
};

XML.ObjTree.prototype.parseHTTP = function (url, options, callback) {
    var myopt = {};
    for (var key in options) {
        myopt[key] = options[key];                  // copy object
    }
    if (!myopt.method) {
        if (typeof (myopt.postBody) == "undefined" &&
            typeof (myopt.postbody) == "undefined" &&
            typeof (myopt.parameters) == "undefined") {
            myopt.method = "get";
        } else {
            myopt.method = "post";
        }
    }
    if (callback) {
        myopt.asynchronous = true;                  // async-mode
        var __this = this;
        var __func = callback;
        var __save = myopt.onComplete;
        myopt.onComplete = function (trans) {
            var tree;
            if (trans && trans.responseXML && trans.responseXML.documentElement) {
                tree = __this.parseDOM(trans.responseXML.documentElement);
            } else if (trans && trans.responseText) {
                tree = __this.parseXML(trans.responseText);
            }
            __func(tree, trans);
            if (__save) __save(trans);
        };
    } else {
        myopt.asynchronous = false;                 // sync-mode
    }
    var trans;
    if (typeof (HTTP) != "undefined" && HTTP.Request) {
        myopt.uri = url;
        var req = new HTTP.Request(myopt);        // JSAN
        if (req) trans = req.transport;
    } else if (typeof (Ajax) != "undefined" && Ajax.Request) {
        var req = new Ajax.Request(url, myopt);   // ptorotype.js
        if (req) trans = req.transport;
    }

    if (callback) return trans;
    if (trans && trans.responseXML && trans.responseXML.documentElement) {
        return this.parseDOM(trans.responseXML.documentElement);
    } else if (trans && trans.responseText) {
        return this.parseXML(trans.responseText);
    }
}

XML.ObjTree.prototype.parseDOM = function (root) {
    if (!root) return;

    this.__force_array = {};
    if (this.force_array) {
        for (var i = 0; i < this.force_array.length; i++) {
            this.__force_array[this.force_array[i]] = 1;
        }
    }

    var json = this.parseElement(root);   // parse root node
    if (this.__force_array[root.nodeName]) {
        json = [json];
    }
    if (root.nodeType != 11) {            // DOCUMENT_FRAGMENT_NODE
        var tmp = {};
        tmp[root.nodeName] = json;          // root nodeName
        json = tmp;
    }
    return json;
};

XML.ObjTree.prototype.parseElement = function (elem) {
    //  COMMENT_NODE
    if (elem.nodeType == 7) {
        return;
    }

    //  TEXT_NODE CDATA_SECTION_NODE
    if (elem.nodeType == 3 || elem.nodeType == 4) {
        var bool = elem.nodeValue.match(/[^\x00-\x20]/);
        if (bool == null) return;     // ignore white spaces
        return elem.nodeValue;
    }

    var retval;
    var cnt = {};

    //  parse attributes
    if (elem.attributes && elem.attributes.length) {
        retval = {};
        for (var i = 0; i < elem.attributes.length; i++) {
            var key = elem.attributes[i].nodeName;
            if (typeof (key) != "string") continue;
            var val = elem.attributes[i].nodeValue;
            if (!val) continue;
            key = this.attr_prefix + key;
            if (typeof (cnt[key]) == "undefined") cnt[key] = 0;
            cnt[key]++;
            this.addNode(retval, key, cnt[key], val);
        }
    }

    //  parse child nodes (recursive)
    if (elem.childNodes && elem.childNodes.length) {
        var textonly = true;
        if (retval) textonly = false;        // some attributes exists
        for (var i = 0; i < elem.childNodes.length && textonly; i++) {
            var ntype = elem.childNodes[i].nodeType;
            if (ntype == 3 || ntype == 4) continue;
            textonly = false;
        }
        if (textonly) {
            if (!retval) retval = "";
            for (var i = 0; i < elem.childNodes.length; i++) {
                retval += elem.childNodes[i].nodeValue;
            }
        } else {
            if (!retval) retval = {};
            for (var i = 0; i < elem.childNodes.length; i++) {
                var key = elem.childNodes[i].nodeName;
                if (typeof (key) != "string") continue;
                var val = this.parseElement(elem.childNodes[i]);
                if (!val) continue;
                if (typeof (cnt[key]) == "undefined") cnt[key] = 0;
                cnt[key]++;
                this.addNode(retval, key, cnt[key], val);
            }
        }
    }
    return retval;
};

XML.ObjTree.prototype.addNode = function (hash, key, cnts, val) {
    if (this.__force_array[key]) {
        if (cnts == 1) hash[key] = [];
        hash[key][hash[key].length] = val;      // push
    } else if (cnts == 1) {                   // 1st sibling
        hash[key] = val;
    } else if (cnts == 2) {                   // 2nd sibling
        hash[key] = [hash[key], val];
    } else {                                    // 3rd sibling and more
        hash[key][hash[key].length] = val;
    }
};

XML.ObjTree.prototype.writeXML = function (tree) {
    var xml = this.hash_to_xml(null, tree);
    return this.xmlDecl + xml;
};

XML.ObjTree.prototype.hash_to_xml = function (name, tree) {
    var elem = [];
    var attr = [];
    for (var key in tree) {
        if (!tree.hasOwnProperty(key)) continue;
        var val = tree[key];
        if (key.charAt(0) != this.attr_prefix) {
            if (typeof (val) == "undefined" || val == null) {
                elem[elem.length] = "<" + key + " />";
            } else if (typeof (val) == "object" && val.constructor == Array) {
                elem[elem.length] = this.array_to_xml(key, val);
            } else if (typeof (val) == "object") {
                elem[elem.length] = this.hash_to_xml(key, val);
            } else {
                elem[elem.length] = this.scalar_to_xml(key, val);
            }
        } else {
            attr[attr.length] = " " + (key.substring(1)) + '="' + (this.xml_escape(val)) + '"';
        }
    }
    var jattr = attr.join("");
    var jelem = elem.join("");
    if (typeof (name) == "undefined" || name == null) {
        // no tag
    } else if (elem.length > 0) {
        if (jelem.match(/\n/)) {
            jelem = "<" + name + jattr + ">\n" + jelem + "</" + name + ">\n";
        } else {
            jelem = "<" + name + jattr + ">" + jelem + "</" + name + ">\n";
        }
    } else {
        jelem = "<" + name + jattr + " />\n";
    }
    return jelem;
};

XML.ObjTree.prototype.array_to_xml = function (name, array) {
    var out = [];
    for (var i = 0; i < array.length; i++) {
        var val = array[i];
        if (typeof (val) == "undefined" || val == null) {
            out[out.length] = "<" + name + " />";
        } else if (typeof (val) == "object" && val.constructor == Array) {
            out[out.length] = this.array_to_xml(name, val);
        } else if (typeof (val) == "object") {
            out[out.length] = this.hash_to_xml(name, val);
        } else {
            out[out.length] = this.scalar_to_xml(name, val);
        }
    }
    return out.join("");
};

XML.ObjTree.prototype.scalar_to_xml = function (name, text) {
    if (name == "#text") {
        return this.xml_escape(text);
    } else {
        return "<" + name + ">" + this.xml_escape(text) + "</" + name + ">\n";
    }
};

XML.ObjTree.prototype.xml_escape = function (text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};



var VERSION = '1.0',
    PROGRAM = 'BASIS';

function isEqualFloat(v1, v2) {
    return Math.abs(v1 - v2) < 0.001;
}

function rnd2(val) {
    result = parseFloat(val).toFixed(2);
    if (result == -0)
        result = 0;
    return result;
}

function rnd1(val) {
    return parseFloat(val).toFixed(1);
}

function Hole(Position, EndPosition, Direction, obj) {
    this.Position = Position;
    this.EndPosition = EndPosition;
    this.Direction = Direction;
    this.obj = obj;
    this.used = false;
};


var Doc = {};
Doc.document = { element: [] };

var holes = [];

function SetMetaInfo() {
    Doc.document.MetaBasis = {
        version: VERSION,
        program: PROGRAM
    };
}

function GatherHolesInfo(Model) {
    for (var i = 0; i < Model.Count; i++) {
        var node = Model[i];
        if (GetObjType(node) !== 'furniture') continue;
        for (var j = 0; j < node.Holes.Count; j++) {
            var hole = node.Holes[j];
            holes.push(new Hole(node.ToGlobal(hole.Position), node.ToGlobal(hole.EndPosition()), node.NToGlobal(hole.Direction), hole));
        }
    }
}

function GatherPanelInfo(Model) {
    for (var i = 0; i < Model.Count; i++) {
        var node = Model[i];

        if (node.List) {
            GatherPanelInfo(node)
        } else {
            if (GetObjType(node) !== 'panel') continue;
            var line = {};

            line['-id'] = i;

            line.name = node.Name;
            line.materialName = node.MaterialName;

            line.gabaritWidth = node.GSize.x;
            line.gabaritHeight = node.GSize.y;

            line.contourWidth = node.ContourWidth; //ширина контура.
            line.contourHeight = node.ContourHeight; //высота контура.

            line.thickness = Math.round(node.Thickness); //Толщина объекта.
            line.textureOrientation = node.TextureOrientation;

            line.cuts = GetCuts(node.Cuts, line);
            const part = GetButts(node);
            line.edges = GetEdges(node.Butts, part.el);

            ClipPanel(line);

            line.holes = GetHoles(node, part);

            //line.holes.hole = CalcShortCoords(line.holes.hole, line.gabaritWidth, line.gabaritHeight, line.contourWidth, line.gabaritHeight);
            //line.holes.hole = ClipHoles(line.holes.hole, line.edges);


            Doc.document.element.push(line);
        }
    }
}

//calc shortX shortY
function CalcShortCoords(holes, edges, gW, gH, w, h) {

    for (let i = 0; i < holes.length; i += 1) {
        const h = holes[i];
        h.x = h.x > width / 2 ? h.x - width : h.x;
        h.y = h.y > height / 2 ? h.y - height : h.y;
    }

    return holes;
}

function ClipHoles(holes, edges) {

    for (let i = 0; i < edges.length; i += 1) {
        if (edges[i].pos === 'top') {
            for (let j = 0; j < holes.length; j += 1) {
                holes[j].y -= edges[i].thickness;
            }
        } else if (edges[i].pos === 'right') {
            for (let j = 0; j < holes.length; j += 1) {
                holes[j].x -= edges[i].thickness;
            }
        }
    }
    return holes;
}

function ClipPanel(line) {
    for (var i = 0; i < line.edges.length; i += 1) {
        if (line.edges[i].pos === 'top' || line.edges[i].pos === 'bottom') {
            line.contourHeight = line.contourHeight - (line.edges[i].clipPanel ? line.edges[i].thickness : 0) - line.edges[i].allowance;
        } else if (line.edges[i].pos === 'left' || line.edges[i].pos === 'right') {
            line.contourWidth = line.contourWidth - (line.edges[i].clipPanel ? line.edges[i].thickness : 0) - line.edges[i].allowance;
        }
    }
    line.contourWidth = Math.round(line.contourWidth);
    line.contourHeight = Math.round(line.contourHeight);
}

function GetEdges(butts, gabEdges) {
    var res = [];

    for (var i = 0; i < 4; i += 1) {

        if (!gabEdges[i]) continue;
        var ge = gabEdges[i], pos;

        if (i === 0) {
            pos = 'top';
        } else if (i === 1) {
            pos = 'bottom';
        } else if (i === 2) {
            pos = 'left';
        } else if (i === 3) {
            pos = 'right';
        }

        var butt = {
            sign: ge.sign,
            thickness: ge.t,
            allowance: ge.allowance,
            clipPanel: ge.clipPanel,
            pos: pos
        }
        if (ge.m) {
            butt.material = ge.m;
        }

        res.push(butt);
    }
    return res;
}

function GetMinMax(node) {
    var minX = 1000000;
    var minY = 1000000;
    var maxX = -1000000;
    var maxY = -1000000;
    if (node.Contour.Count > 0) {
        for (var i = 0; i < node.Contour.Count; i++) {
            elem = node.Contour[i];
            if (elem.ElType == 1) {
                minX = Math.min(minX, elem.Pos1.x);
                minY = Math.min(minY, elem.Pos1.y);
                maxX = Math.max(maxX, elem.Pos1.x);
                maxY = Math.max(maxY, elem.Pos1.y);
                minX = Math.min(minX, elem.Pos2.x);
                minY = Math.min(minY, elem.Pos2.y);
                maxX = Math.max(maxX, elem.Pos2.x);
                maxY = Math.max(maxY, elem.Pos2.y);
            } else if (elem.ElType == 2) {

                if (elem.AngleOnArc(Math.PI) == true) {
                    minX = Math.min(minX, elem.Center.x - elem.ArcRadius());
                } else {
                    minX = Math.min(minX, elem.Pos1.x);
                    minX = Math.min(minX, elem.Pos2.x);
                }

                if (elem.AngleOnArc(0) || elem.AngleOnArc(Math.PI * 2.0)) {
                    maxX = Math.max(maxX, elem.Center.x + elem.ArcRadius());
                } else {
                    maxX = Math.max(maxX, elem.Pos1.x);
                    maxX = Math.max(maxX, elem.Pos2.x);
                }
                if (elem.AngleOnArc((Math.PI * 3.0) / 2.0)) {
                    minY = Math.min(minY, elem.Center.y - elem.ArcRadius());
                } else {
                    minY = Math.min(minY, elem.Pos1.y);
                    minY = Math.min(minY, elem.Pos2.y);
                }
                if (elem.AngleOnArc(Math.PI / 2.0)) {
                    maxY = Math.max(maxY, elem.Center.y + elem.ArcRadius());
                } else {
                    maxY = Math.max(maxY, elem.Pos1.y);
                    maxY = Math.max(maxY, elem.Pos2.y);
                }
            } else if (elem.ElType == 3) {
                minX = Math.min(minX, elem.Center.x - elem.CirRadius);
                minY = Math.min(minY, elem.Center.y - elem.CirRadius);
                maxX = Math.max(maxX, elem.Center.x + elem.CirRadius);
                maxY = Math.max(maxY, elem.Center.y + elem.CirRadius);
            }
        }
    } else {
        minX = node.GMin.x;
        minY = node.GMin.y;
        maxX = node.GMax.x;
        maxY = node.GMax.y;
    }


    return {
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY
    };
}

function GetButts(node) {
    function getButtForLine(node, elem) {
        var res = null;
        if (elem.Tag === undefined) {
            res = elem.Data.Butt;
        } else if (elem.Tag >= 0) {
            res = node.Butts[elem.Tag];
        }

        return res;
    }

    function OpEdge(Material, Thickness, Width, ClipPanel, Allowance, Sign) {
        this.name = Material;
        this.t = Thickness;
        this.w = Width;
        this.clipPanel = ClipPanel;
        this.allowance = Allowance;
        this.sign = Sign;
        this.parts = [];
    }
    var operationId = 1;
    var opEdges = [];

    function addEdge(part, Material, Thickness, Width, ClipPanel, Allowance, Sign) {
        var opEdge = null;
        for (var i = 0; i < opEdges.length; i++) {
            var op = opEdges[i];
            if (Material == op.name && Thickness == op.t && Width == op.w) {
                opEdge = op;
                break;
            }
        }
        if (opEdge == null) {
            opEdge = new OpEdge(Material, Thickness, Width, ClipPanel, Allowance, Sign);
            opEdge.id = operationId++;
            opEdges.push(opEdge);
        }
        for (var i = 0; i < opEdge.parts.length; i++)
            if (opEdge.parts[i] == part)
                return opEdge;
        opEdge.parts.push(part);
        return opEdge;
    };

    var MM = GetMinMax(node),
        minX = MM.minX,
        minY = MM.minY,
        maxX = MM.maxX,
        maxY = MM.maxY;

    var part = {};
    part.contour = [];
    part.el = [];

    if (node.Contour.Count > 0) {
        var contourItem, srcContour, dstContours;
        //Разбиваем общий контур на составляющие
        srcContour = node.Contour.MakeCopy();
        for (var j = 0; j < srcContour.Count; j++) {
            srcContour[j].Tag = -1;
        }
        for (var j = 0; j < node.Butts.Count; j++) {
            srcContour[node.Butts[j].ElemIndex].Tag = j;
        }
        //Отделяем окружности
        dstContours = [];
        var contourClear = srcContour.MakeCopy();
        contourClear.Clear();
        for (var j = 0; j < srcContour.Count; j++) {
            if (srcContour[j].ElType == 3) {
                contourItem = contourClear.MakeCopy();
                contourItem.Add(srcContour[j]);
                dstContours.push(contourItem.MakeCopy());
                srcContour.Delete(srcContour[j]);
                j--;
            }
        }

        //Отделяем не связанные контуры
        if (srcContour.Count > 0) {
            srcContour.OrderContours();
            while (srcContour.Count > 0) {
                var elem1 = srcContour[srcContour.Count - 1].MakeCopy();
                srcContour.Delete(srcContour[srcContour.Count - 1]);
                contourItem = contourClear.MakeCopy();
                contourItem.Add(elem1);
                dstContours.push(contourItem);
                start: for (var k = 0; k < contourItem.Count; k++) {
                    var elem2 = contourItem[k];
                    for (var j = 0; j < srcContour.Count; j++) {
                        elem1 = srcContour[j].MakeCopy();
                        if (isEqualFloat(elem1.Pos2.x, elem2.Pos1.x) && isEqualFloat(elem1.Pos2.y, elem2.Pos1.y) ||
                            isEqualFloat(elem1.Pos1.x, elem2.Pos2.x) && isEqualFloat(elem1.Pos1.y, elem2.Pos2.y) || isEqualFloat(elem1.Pos1.x, elem2.Pos1.x) && isEqualFloat(elem1.Pos1.y, elem2.Pos1.y) ||
                            isEqualFloat(elem1.Pos2.x, elem2.Pos2.x) && isEqualFloat(elem1.Pos2.y, elem2.Pos2.y)
                        ) {
                            contourItem.Add(elem1);
                            srcContour.Delete(srcContour[j]);
                            continue start;
                        }
                    }
                }
            }
        }

        for (var jc = 0; jc < dstContours.length; jc++) {
            contourItem = dstContours[jc];
            contourItem.OrderContours();
            contourItem.clockOtherWise = false;

            for (var ic = 0; ic < dstContours.length; ic++)
                if (ic != jc) {
                    var p = contourItem[0].ElType == 3 ? contourItem[0].Center : contourItem[0].Pos1;
                    contourItem.clockOtherWise = contourItem.clockOtherWise || (contourItem.IsInContour === undefined ? dstContours[ic].IsPointInside(p, 0, true) : contourItem.IsInContour(dstContours[ic]));
                }
            if (contourItem.IsClosedContour() && contourItem.IsClockOtherWise())
                contourItem.InvertDirection();

            var contElement = {};
            var cntRect = 0;
            var cntr = [];

            for (var j = 0; j < contourItem.Count; j++) {
                cntr.push(contourItem[j]);
            }

            var elCan = [];
            elCan[0] = true;
            elCan[1] = true;
            elCan[2] = true;
            elCan[3] = true;
            var elem, butt;
            for (var j = 0; j < cntr.length; j++) {
                elem = cntr[j];
                butt = getButtForLine(node, elem);
                var contourLen = elem.ObjLength();
                if (elem.ElType == 1) {
                    if (rnd1(elem.Pos1.x - minX) == 0 && rnd1(elem.Pos2.x - minX) == 0 && rnd1(contourLen - part.cw) == 0) {
                        cntRect++;
                        if (butt != null) part.el[2] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        cntr[j] = null;
                        elCan[2] = false;
                    } else if (rnd1(elem.Pos1.y - maxY) == 0 && rnd1(elem.Pos2.y - maxY) == 0 && rnd1(contourLen - part.cl) == 0) {
                        cntRect++;
                        if (butt != null) part.el[0] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        cntr[j] = null;
                        elCan[0] = false;
                    } else if (rnd1(elem.Pos1.x - maxX) == 0 && rnd1(elem.Pos2.x - maxX) == 0 && rnd1(contourLen - part.cw) == 0) {
                        cntRect++;
                        if (butt != null) part.el[3] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        cntr[j] = null;
                        elCan[3] = false;
                    } else if (rnd1(elem.Pos1.y - minY) == 0 && rnd1(elem.Pos2.y - minY) == 0 && rnd1(contourLen - part.cl) == 0) {
                        cntRect++;
                        if (butt != null) part.el[1] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        cntr[j] = null;
                        elCan[1] = false;
                    }
                }
            }
            for (var j = 0; j < cntr.length; j++) {
                elem = cntr[j];
                if (elem == null || elem.ElType > 1)
                    continue;
                butt = getButtForLine(node, elem);

                if (butt != null) {
                    if (part.el[2] == null && (rnd1(elem.Pos1.x - minX) == 0 && rnd1(elem.Pos2.x - minX) == 0)) {
                        part.el[2] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        cntr[j] = null;
                    } else
                        if (part.el[0] == null && (rnd1(elem.Pos1.y - maxY) == 0 && rnd1(elem.Pos2.y - maxY) == 0)) {
                            part.el[0] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                            cntr[j] = null;
                        } else
                            if (part.el[3] == null && (rnd1(elem.Pos1.x - maxX) == 0 && rnd1(elem.Pos2.x - maxX) == 0)) {
                                part.el[3] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                                cntr[j] = null;
                            } else
                                if (part.el[1] == null && (rnd1(elem.Pos1.y - minY) == 0 && rnd1(elem.Pos2.y - minY) == 0)) {
                                    part.el[1] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                                    cntr[j] = null;
                                }
                }
            }


            for (var j = 0; j < cntr.length; j++) {
                elem = cntr[j];
                if (elem == null)
                    continue;
                butt = getButtForLine(node, elem);

                if (butt != null) {
                    if (elem.ElType == 1) {
                        if (part.el[2] == null && elCan[2] && (rnd1(elem.Pos1.x - minX) == 0 || rnd1(elem.Pos2.x - minX) == 0))
                            part.el[2] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        if (part.el[0] == null && elCan[0] && (rnd1(elem.Pos1.y - maxY) == 0 || rnd1(elem.Pos2.y - maxY) == 0))
                            part.el[0] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        if (part.el[3] == null && elCan[3] && (rnd1(elem.Pos1.x - maxX) == 0 || rnd1(elem.Pos2.x - maxX) == 0))
                            part.el[3] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        if (part.el[1] == null && elCan[1] && (rnd1(elem.Pos1.y - minY) == 0 || rnd1(elem.Pos2.y - minY) == 0))
                            part.el[1] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                    } else if (elem.ElType == 2) {
                        var r = getDistance(elem.Pos1.x, elem.Pos1.y, elem.Center.x, elem.Center.y);
                        if (part.el[2] == null && elCan[2] && (rnd1(elem.Pos1.x - minX) == 0 || rnd1(elem.Pos2.x - minX) == 0 || Math.abs(rnd1((elem.Center.x - r) - minX)) < 3))
                            part.el[2] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        if (part.el[0] == null && elCan[0] && (rnd1(elem.Pos1.y - maxY) == 0 || rnd1(elem.Pos2.y - maxY) == 0 || Math.abs(rnd1((elem.Center.y + r) - maxY)) < 3))
                            part.el[0] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        if (part.el[3] == null && elCan[3] && (rnd1(elem.Pos1.x - maxX) == 0 || rnd1(elem.Pos2.x - maxX) == 0 || Math.abs(rnd1((elem.Center.x + r) - maxX)) < 3))
                            part.el[3] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        if (part.el[1] == null && elCan[1] && (rnd1(elem.Pos1.y - minY) == 0 || rnd1(elem.Pos2.y - minY) == 0 || Math.abs(rnd1((elem.Center.y - r) - minY)) < 3))
                            part.el[1] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                    } else if (elem.ElType == 3) {
                        part.el[0] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        part.el[1] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        part.el[2] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                        part.el[3] = addEdge(part, butt.Material, butt.Thickness, butt.Width, butt.ClipPanel, butt.Allowance, butt.Sign);
                    }
                }
            }

            if (cntRect < 4) {
                var contour = {};
                contour.path = [];
                part.contour.push(contour);
                contour.clockOtherWise = contourItem.clockOtherWise;
                contour.inner = contourItem.clockOtherWise;
                for (var j = 0; j < contourItem.Count; j++) {
                    var elem = contourItem[j];
                    if (elem.ElType != 3 && rnd1(elem.Pos1.x - elem.Pos2.x) == 0 && rnd1(elem.Pos1.y - elem.Pos2.y) == 0)
                        continue;
                    var contElement = {};
                    contElement.line = false;
                    contElement.Type = elem.ElType;
                    contElement.lineSideFull = false;
                    var contourLen = elem.ObjLength();

                    if (elem.ElType == 1) {
                        contElement.sx = elem.Pos1.x - minX;
                        contElement.sy = elem.Pos1.y - minY;
                        contElement.ex = elem.Pos2.x - minX;
                        contElement.ey = elem.Pos2.y - minY;
                        //Left Right
                        if (rnd1(contElement.sx) == 0 && rnd1(contElement.ex) == 0 || rnd1(elem.Pos1.x - maxX) == 0 && rnd1(elem.Pos2.x - maxX) == 0) {
                            contElement.lineSide = true;
                            contElement.lineSideFull = rnd1(contourLen - part.cw) == 0;
                        }
                        //Top Bottom
                        if (rnd1(elem.Pos1.y - maxY) == 0 && rnd1(elem.Pos2.y - maxY) == 0 || rnd1(contElement.sy) == 0 && rnd1(contElement.ey) == 0) {
                            contElement.lineSide = true;
                            contElement.lineSideFull = rnd1(contourLen - part.cl) == 0;
                        }
                        contElement.sy = part.cw - contElement.sy;
                        contElement.ey = part.cw - contElement.ey;
                        contour.path.push(contElement);
                    } else if (elem.ElType == 2) {
                        contElement.cx = elem.Center.x - minX;
                        contElement.cy = part.cw - (elem.Center.y - minY);
                        contElement.sx = elem.Pos1.x - minX;
                        contElement.sy = part.cw - (elem.Pos1.y - minY);
                        contElement.sa = (elem.Pos1Angle() * 180.0) / Math.PI;
                        contElement.ex = elem.Pos2.x - minX;
                        contElement.ey = part.cw - (elem.Pos2.y - minY);
                        contElement.ea = (elem.Pos2Angle() * 180.0) / Math.PI;
                        contElement.r = elem.ArcRadius();
                        contElement.dir = !elem.ArcDir;
                        contour.path.push(contElement);
                    } else if (elem.ElType == 3) {
                        contElement.cx = elem.Center.x - minX;
                        contElement.cy = part.cw - (elem.Center.y - minY);
                        contElement.r = elem.CirRadius;
                        contElement.dir = false;
                        contour.path.push(contElement);
                    } else {
                        alert('Неизвестный элемент контура');
                    }
                }

            }
        }
    }

    return part;
}

function GetHoles(node, part1) {
    var part = {};
    part.el = part1.el;
    part.bFront = [];
    part.bBack = [];
    part.cFront = [];
    part.cBack = [];
    part.cl = node.ContourWidth;
    part.cw = node.ContourHeight;
    part.thick = node.Thickness;
    part.contour = part1.contour;

    var bThrough = [],
        bHor = [],
        cThrough = [];

    var MM = GetMinMax(node),
        minX = MM.minX,
        minY = MM.minY,
        maxX = MM.maxX,
        maxY = MM.maxY;

    function Bore(plane, d, x, y, z, dp) {
        this.plane = plane;
        this.d = d;
        this.x = x;
        this.y = y;
        this.z = z;
        this.dp = dp;
    };

    function compare(v1, v2) {
        if (Math.abs(v1 - v2) < 0.001)
            return 0;
        else
            return v1 > v2 ? 1 : -1;
    }

    function sortBores(b1, b2) {
        r = compare(b1.plane, b2.plane);
        if (r != 0)
            return r;

        r = compare(b1.d, b2.d);
        if (r != 0)
            return r;

        r = compare(b1.x, b2.x);
        if (r != 0)
            return r;
        r = compare(b1.y, b2.y);
        if (r != 0)
            return r;
        r = compare(b1.z, b2.z);
        if (r != 0)
            return r;

        r = compare(b1.dp, b2.dp);
        if (r != 0)
            return r;

        return 0;
    }

    for (var i = 0; i < holes.length; i++) {
        var hole,
            holePos,
            holeDir,
            hz,
            depth,
            b;

        hole = holes[i];
        if (hole.used) continue;
        holePos = node.GlobalToObject(hole.Position);
        if (holePos.z < -(hole.obj.Depth + node.Thickness) || (holePos.z > hole.obj.Depth + node.Thickness))
            continue;
        holeDir = node.NToObject(hole.Direction);
        if (rnd2(Math.abs(holeDir.z)) == 1 && node.Contour.IsPointInside(holePos)) {
            hz = holePos.z;
            const hy = node.TextureOrientation === 1 ? holePos.y + minY : part.cw - holePos.y + minY;
            if (holeDir.z > 0.001) {
                if (hz <= 0.001 && (hz + hole.obj.Depth) > 0) {
                    depth = hz + hole.obj.Depth;


                    b = new Bore(5, hole.obj.Diameter, holePos.x - minX, hy, 0, rnd2(depth));
                    if (Math.round(part.thick * 10) > Math.round(b.dp * 10))
                        part.bBack.push(b);
                    else {
                        bThrough.push(b);
                    }
                    hole.used = isEqualFloat(hz, 0) && (node.Thickness >= hole.obj.Depth);

                }
                continue;
            } else {
                depth = hole.obj.Depth - (hz - node.Thickness);
                if ((hz - node.Thickness) >= -0.001 && depth >= 0.001) {
                    b = new Bore(4, hole.obj.Diameter, holePos.x - minX, hy, 0, rnd2(depth));
                    if (Math.round(part.thick * 10) > Math.round(b.dp * 10))
                        part.bFront.push(b);
                    else
                        bThrough.push(b);
                    hole.used = isEqualFloat(hz, node.Thickness) && (node.Thickness >= hole.obj.Depth);
                }
                continue;
            }
        }
        if (rnd2(holeDir.z) != 0 || holePos.z <= 0 || holePos.z >= node.Thickness) continue;

        holeEndPos = node.GlobalToObject(hole.EndPosition);
        if (node.Contour.IsPointInside(holeEndPos)) {
            hdx = rnd2(holeDir.x);
            hdy = rnd2(holeDir.y);
            holeEndPos = node.GlobalToObject(hole.EndPosition);
            for (var j = 0; j < node.Contour.Count; j++) {
                contour = node.Contour[j];
                contourButt = contour.Data != null && contour.Data.Butt != null ? contour.Data.Butt : null;
                var bt = (contourButt != null && contourButt.ClipPanel == false) ? contourButt.Thickness : 0;
                if ((rnd2(contour.DistanceToPoint(holePos) + contour.DistanceToPoint(holeEndPos)) == rnd2(hole.obj.Depth) && (rnd2(contour.DistanceToPoint(holeEndPos) + bt) > 2))) {
                    dp = rnd2(contour.DistanceToPoint(holeEndPos) + bt);
                    const hy = node.TextureOrientation === 1 ? holePos.y + minY : part.cw - holePos.y + minY;
                    if (hdx == 1) {
                        bHor.push(new Bore(2, hole.obj.Diameter, 0, hy, part.thick - holePos.z, dp));
                        hole.used = isEqualFloat(dp, hole.obj.Depth);
                        break;
                    } else if (hdx == -1) {
                        bHor.push(new Bore(3, hole.obj.Diameter, 0, hy, part.thick - holePos.z, dp));
                        hole.used = isEqualFloat(dp, hole.obj.Depth);;
                        break;
                    } else if (hdx == 0) {
                        if (hdy == 1) {
                            bHor.push(new Bore(1, hole.obj.Diameter, holePos.x - minX, 0, part.thick - holePos.z, dp));
                        } else if (hdy == -1) {
                            bHor.push(new Bore(0, hole.obj.Diameter, holePos.x - minX, 0, part.thick - holePos.z, dp));
                        }
                        hole.used = isEqualFloat(dp, hole.obj.Depth);
                        break;
                    }
                }
            }
        }
    }

    if (part.bFront.length == 0 && part.cFront.length == 0 && (part.bBack.length > 0 || part.cBack.length > 0)) {
        part.offsetX = part.dl - (part.cl + (minX - node.GMin.x));
        var te = part.el[2];
        part.el[2] = part.el[3];
        part.el[3] = te;
        //bore
        part.bFront = part.bFront.concat(part.bBack);
        if (bThrough.length > 0)
            part.bFront = part.bFront.concat(bThrough);
        if (bHor.length > 0)
            part.bFront = part.bFront.concat(bHor);
        part.bBack = [];
        //cut
        part.cFront = part.cFront.concat(part.cBack);
        if (cThrough.length > 0)
            part.cFront = part.cFront.concat(cThrough);
        part.cBack = [];
        //
        for (var bi = 0; bi < part.bFront.length; bi++) {
            var bore = part.bFront[bi];
            switch (bore.plane) {
                case 0:
                case 1:
                    bore.x = part.cl - bore.x;
                    bore.z = part.thick - bore.z;
                    break;
                case 2:
                    bore.plane = 3;
                    bore.z = part.thick - bore.z;
                    break;
                case 3:
                    bore.plane = 2;
                    bore.z = part.thick - bore.z;
                    break;
                case 4:
                case 5:
                    bore.x = part.cl - bore.x;
                    break;
            }
        }
        for (var ci = 0; ci < part.cFront.length; ci++) {
            var cut = part.cFront[ci];
            cut.offset = -cut.offset;
            for (var i = 0; i < cut.path.length; i++) {
                elem = cut.path[i];
                if (elem.Type == 1) {
                    elem.sx = part.cl - elem.sx;
                    elem.ex = part.cl - elem.ex;
                } else if (elem.Type == 2) {
                    elem.sx = part.cl - elem.sx;
                    elem.ex = part.cl - elem.ex;
                    elem.cx = part.cl - elem.cx;
                    elem.dir = !elem.dir;
                } else if (elem.Type == 3) {
                    elem.cx = part.cl - elem.cx;
                }
            }
        }



        for (var j = 0; j < part.contour.length; j++) {
            contour = part.contour[j];
            if (contour.path[0].Type != 3)
                contour.clockOtherWise = !contour.clockOtherWise;
            for (var i = 0; i < contour.path.length; i++) {
                contElement = contour.path[i];
                if (contElement.Type == 1) {
                    contElement.sx = part.cl - contElement.sx;
                    contElement.ex = part.cl - contElement.ex;
                } else if (contElement.Type == 2) {
                    contElement.sx = part.cl - contElement.sx;
                    contElement.ex = part.cl - contElement.ex;
                    contElement.cx = part.cl - contElement.cx;
                    contElement.dir = !contElement.dir;
                } else if (contElement.Type == 3) {
                    contElement.cx = part.cl - contElement.cx;
                }
            }
        }
    } else if (bThrough.length > 0 || bHor.length > 0 || cThrough.length > 0) {
        part.bFront = part.bFront.concat(bThrough, bHor);
        part.cFront = part.cFront.concat(cThrough);
    }

    part.bExThrough = bThrough.length > 0;
    part.cExThrough = cThrough.length > 0;
    part.bFront.sort(sortBores);
    part.bBack.sort(sortBores);

    var hole = [];
    for (var i = 0; i < part.bFront.length; i += 1) {
        var h = part.bFront[i];
        hole.push({
            type: 'front',
            x: h.x,
            y: h.y,
            z: h.z,
            d: h.d,
            dp: h.dp,
            side: part.bFront[i].plane,
            type: h.dp >= part.thick ? 'through' : 'noThrough'
        });
    }


    for (var i = 0; i < part.bBack.length; i += 1) {
        var h = part.bBack[i];
        hole.push({
            type: 'back',
            x: h.x,
            y: h.y,
            z: h.z,
            d: h.d,
            dp: h.dp,
            side: part.bBack[i].plane,
            type: h.dp >= part.thick ? 'through' : 'noThrough'
        });
    }

    return {
        hole: hole
    };
}

function GetCuts(cuts, line) {
    var res = [],
        msg4mm = true,
        msgRect = true,
        pos;
    for (var i = 0; i < cuts.Count; i += 1) {
        var c = cuts[i],
            cut = {};
        if (c.Trajectory === undefined && c.Trajectory.Count === 0) continue;

        var grooveRect = CheckGrooveOnRect(c);
        if (grooveRect > 0) {
            if (msgRect) {
                alert('Выгружены будут только прямолинейные пазы');
                msgRect = false;
            }
            continue;
        }

        if (c.Contour.Width !== 4) {
            if (msg4mm) {
                alert('Пазы, шириной больше или меньше 4мм выгружены не будут');
                msg4mm = false;
            }
            continue;
        }

        if (c.Trajectory[0].Pos1.x === c.Trajectory[0].Pos2.x) {
            cut.dir = 'v';
            cut.pos = c.Trajectory[0].Pos1.x;
        } else if (c.Trajectory[0].Pos1.y === c.Trajectory[0].Pos2.y) {
            cut.dir = 'h';
            if (line.textureOrientation === 2) {
                cut.pos = line.contourHeight - c.Trajectory[0].Pos1.y;
            } else {
                cut.pos = c.Trajectory[0].Pos1.y;
            }
        }

        cut.name = c.Name;
        cut.depth = c.Contour.Height;
        cut.width = c.Contour.Width;
        cut.sign = c.Sign;
        cut.side = GetSideOfCut(c, line.thickness);

        res.push(cut);
    }

    function CheckGrooveOnRect(c) {
        var res = 0;
        for (var j = 0; j < c.Contour.Count; j++) {
            var elem = c.Contour[j];
            if (elem.ElType != 1) {
                res = 1;
                break;
            }
            if (elem.ElType == 1 && !(isEqualFloat(elem.Pos1.x, elem.Pos2.x) || isEqualFloat(elem.Pos1.y, elem.Pos2.y))) {
                res = 2;
                break;
            }
        }

        if (c.Trajectory[0].Pos1.x !== c.Trajectory[0].Pos2.x && c.Trajectory[0].Pos1.y !== c.Trajectory[0].Pos2.y) {
            res = 3;
        }
        return res;
    }

    function GetSideOfCut(c, partThickness) {
        var res,
            cMinX = Infinity,
            cMaxX = -cMinX,
            cMinY = Infinity,
            cMaxY = -cMinY;

        if (c.Contour.Max == undefined) {
            for (var j = 0; j < c.Contour.Count; j++) {
                var elem = c.Contour[j];
                if (elem.ElType == 1 || elem.ElType == 2) {
                    if (cMinX > elem.Pos1.x)
                        cMinX = elem.Pos1.x;
                    else if (cMaxX < elem.Pos1.x)
                        cMaxX = elem.Pos1.x;
                    if (cMinY > elem.Pos1.y)
                        cMinY = elem.Pos1.y;
                    else if (cMaxY < elem.Pos1.y)
                        cMaxY = elem.Pos1.y;
                    if (cMinX > elem.Pos2.x)
                        cMinX = elem.Pos2.x;
                    else if (cMaxX < elem.Pos2.x)
                        cMaxX = elem.Pos2.x;
                    if (cMinY > elem.Pos2.y)
                        cMinY = elem.Pos2.y;
                    else if (cMaxY < elem.Pos2.y)
                        cMaxY = elem.Pos2.y;
                } else if (elem.ElType == 3) {
                    if (cMinX > (elem.Center.x - elem.CirRadius))
                        cMinX = elem.Center.x - elem.CirRadius;
                    else if (cMaxX < (elem.Center.x + elem.CirRadius))
                        cMaxX = elem.Center.x + elem.CirRadius;
                    if (cMinY > (elem.Center.y - elem.CirRadius))
                        cMinY = elem.Center.y - elem.CirRadius;
                    else if (cMaxY < (elem.Center.y + elem.CirRadius))
                        cMaxY = elem.Center.y + elem.CirRadius;
                } else {
                    alert('Неизвестный элемент траектории');
                }
            }
        } else {
            cMinX = c.Contour.Min.x;
            cMaxX = c.Contour.Max.x;
            cMinY = c.Contour.Min.y;
            cMaxY = c.Contour.Max.y;
        }


        if (cMaxY >= (partThickness - 0.001)) {
            res = 'front';
        } else if (cMinY <= 0.001) {
            res = 'back';
        }
        return res;
    }

    return {
        cut: res
    };
}

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

function GetObjType(obj) {
    var res = null;
    for (var key in obj) {
        if (key === 'TextureOrientation') {
            res = 'panel';
        } else if (key === 'Holes') {
            res = 'furniture';
        }
    }
    return res;
}


SetMetaInfo();
GatherHolesInfo(Model);
GatherPanelInfo(Model);


xotree = new XML.ObjTree();
xml = xotree.writeXML(Doc);

system.askWriteTextFile('xml', xml);
