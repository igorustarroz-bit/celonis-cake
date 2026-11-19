"""Convert the cream, cherry and stem of a 3D model (OBJ) into js/cake-3d-cream.js for the slice hero.
Usage: python3 cake/tools/obj-to-cream.py model.obj cake/js/cake-3d-cream.js
Parts: material "01" = cream, "09-cherry" = cherry, second-largest piece of "03-coffee" = stem (as in 0016.obj)."""
import sys,collections,base64,struct,json
V=[];mat=None;F=collections.defaultdict(list)
for l in open(sys.argv[1]):
    p=l.split()
    if not p: continue
    if p[0]=='v': V.append(tuple(map(float,p[1:4])))
    elif p[0]=='usemtl': mat=p[1]
    elif p[0]=='f': F[mat].append([int(x.split('/')[0])-1 for x in p[1:]])
def comps(fs):
    par={}
    def find(a):
        while par.setdefault(a,a)!=a: par[a]=par[par[a]]; a=par[a]
        return a
    for f in fs:
        for i in f[1:]: par[find(i)]=find(f[0])
    g=collections.defaultdict(list)
    for f in fs: g[find(f[0])].append(f)
    return sorted(g.values(),key=len,reverse=True)
parts={'cream':F['01'],'cherry':F['09-cherry'],'stem':comps(F['03-coffee'])[1]}
allv=[V[i] for fs in parts.values() for f in fs for i in f]
mn=[min(v[k] for v in allv) for k in range(3)]; mx=[max(v[k] for v in allv) for k in range(3)]
out={'min':mn,'max':mx,'parts':{}}
for name,fs in parts.items():
    remap={};pos=[];idx=[]
    for f in fs:
        loc=[]
        for i in f:
            if i not in remap:
                remap[i]=len(remap); v=V[i]
                pos+= [round((v[k]-mn[k])/(mx[k]-mn[k])*65535) for k in range(3)]
            loc.append(remap[i])
        for t in range(1,len(f)-1): idx+=[loc[0],loc[t],loc[t+1]]
    out['parts'][name]={'p':base64.b64encode(struct.pack('<%dH'%len(pos),*pos)).decode(),'i':base64.b64encode(struct.pack('<%dH'%len(idx),*idx)).decode(),'nv':len(remap),'nt':len(idx)//3}
    print(name,len(remap),len(idx)//3, file=sys.stderr)
js='''/* Cream and cherry for the slice hero (version glass-3d-slice): the whipped cream, the cherry and its stem taken
   as they are from Igor's 3D model 0016.obj (materials "01", "09-cherry" and the small "03-coffee" piece). Positions are
   uint16 quantized into the box [min, max] (OBJ units, Y up); indices are uint16 triangles. Read by cake-3d.js. */
window.CAKE3D_CREAM = '''+json.dumps(out,separators=(',',':'))+';\n'
open(sys.argv[2],'w').write(js)
