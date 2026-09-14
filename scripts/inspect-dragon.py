from pathlib import Path
import trimesh, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
mesh=trimesh.load('public/models/dragon.stl')
parts=sorted(mesh.split(only_watertight=False),key=lambda p:len(p.faces),reverse=True)
print('components:',len(parts))
fig=plt.figure(figsize=(12,8));ax=fig.add_subplot(111,projection='3d')
for i,p in enumerate(parts):
 print(i,len(p.faces),np.round(p.bounds,2).tolist(), 'center',np.round(p.centroid,2).tolist())
 if len(p.faces)<10:continue
 color=plt.cm.tab20(i%20)
 ax.add_collection3d(Poly3DCollection(p.triangles,facecolors=color,shade=True))
 ax.text(*p.centroid,str(i),color='black',fontsize=14)
ax.set_xlim(0,64);ax.set_ylim(0,44);ax.set_zlim(0,18);ax.set_box_aspect([64,44,18]);ax.view_init(elev=65,azim=-90)
Path('outputs').mkdir(exist_ok=True)
fig.savefig('outputs/dragon-parts.png',dpi=130,metadata={})
