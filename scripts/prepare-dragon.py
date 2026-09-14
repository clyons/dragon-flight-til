"""Split the supplied STL by connectivity; preserve every triangle, including eyes.
Requires numpy, scipy, trimesh. Run from repository root.
"""
import json, hashlib
from pathlib import Path
import numpy as np
import trimesh
source=Path('public/models/dragon.stl')
mesh=trimesh.load(source)
components=sorted(mesh.split(only_watertight=False),key=lambda p:len(p.faces),reverse=True)
order=[2,3,0,1,5,4,6]
names=['Head','Shoulders','Wings & torso','Hind legs','Tail base','Tail middle','Tail tip']
scale=.18

def convert(p):
 p=np.array(p,dtype=float)
 return np.stack([(p[...,0]-31.920475)*scale,p[...,2]*scale,-(p[...,1]-21.7185515)*scale],axis=-1)
def contact_hull(vertices):
 # Use supporting planes, not an inscribed vertex subset: cheeks and toes
 # must remain inside the collision hull. Eighteen planes need at most 32
 # vertices, keeping the result within Box3D's compact hull limits.
 from scipy.spatial import ConvexHull, HalfspaceIntersection
 source=np.asarray(vertices)
 normals=ConvexHull(source).equations[:,:3]
 selected_normals=list(np.concatenate([np.eye(3),-np.eye(3)]))
 for _ in range(12):
  distances=((normals[:,None,:]-np.array(selected_normals)[None,:,:])**2).sum(axis=2).min(axis=1)
  selected_normals.append(normals[int(np.argmax(distances))])
 directions=np.array(selected_normals)
 support=(source@directions.T).max(axis=0)+.015
 planes=np.column_stack([directions,-support])
 points=HalfspaceIntersection(planes,source.mean(axis=0)).intersections
 assert len(points)<=32
 return points.tolist()

def contact_cells(vertices, faces, divisions):
 # Compound hulls follow the concave silhouette instead of filling the air
 # beneath the horns or behind the toes with one large convex envelope.
 vertices=np.asarray(vertices)
 bounds=np.array([vertices.min(axis=0),vertices.max(axis=0)])
 cuts=[np.linspace(bounds[0,a],bounds[1,a],n+1) for a,n in enumerate(divisions)]
 from itertools import product
 hulls=[]
 for cell in product(*(range(n) for n in divisions)):
  v,f=vertices,faces
  for axis in range(3):
   for side in (1,-1):
    origin=np.zeros(3);normal=np.zeros(3)
    origin[axis]=cuts[axis][cell[axis]+(side<0)];normal[axis]=side
    v,f,_=trimesh.intersections.slice_faces_plane(v,f,normal,origin)
    if len(f)==0:break
   if len(f)==0:break
  if len(f)==0:continue
  v=v[np.unique(f)]
  if len(v)<4 or np.linalg.matrix_rank(v-v.mean(axis=0),tol=1e-6)<3:continue
  hulls.append(contact_hull(v))
 return hulls

parts=[]
for index,(component,name) in enumerate(zip(order,names)):
 p=components[component].copy()
 if index==0:p=trimesh.util.concatenate([p,components[7],components[8]])
 p.vertices=convert(p.vertices)
 center=p.bounds.mean(axis=0)
 p.vertices-=center
 filename=f'part-{index}.stl';p.export(source.parent/filename)
 hull=p.convex_hull.vertices
 # A deterministic farthest-point subset keeps the engine's hull small.
 selected=[int(np.argmax(hull[:,1]))]
 distances=np.full(len(hull),np.inf)
 for _ in range(min(60,len(hull))-1):
  distances=np.minimum(distances,((hull-hull[selected[-1]])**2).sum(axis=1))
  selected.append(int(np.argmax(distances)))
 parts.append(dict(name=name,file=filename,center=center.tolist(),bounds=p.bounds.tolist(),triangles=len(p.faces),hull=hull[selected].tolist()))
 # The two feet need separate hulls: one hull across the shoulders would
 # fill the space beside the neck and prevent its articulation. Clip only
 # collision geometry, leaving the original STL and rendered triangles intact.
 if index==0:
  parts[-1]['headContactHulls']=contact_cells(p.vertices,p.faces,(3,2,3))
 if index in (1,3):
  neck_z=convert([[0,29,0]])[0,2]-center[2]
  foot_hulls=[]
  for side in (-1,1):
   plane_origin=[0,0,neck_z+side*.9]
   vertices,faces,_=trimesh.intersections.slice_faces_plane(p.vertices,p.faces,[0,0,side],plane_origin)
   foot_hulls.extend(contact_cells(vertices,faces,(2,1,1)))
  parts[-1]['footHulls']=foot_hulls
anchors=[[16.1,28.5,4.3],[25.2,29,4.4],[37.7,28.7,4.7],[49.4,29.2,4.3],[59.3,23.3,3.4],[58.6,9.5,2.4]]
manifest=dict(source='dragon.stl',sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),triangles=len(mesh.faces),scale=scale,parts=parts,anchors=convert(anchors).tolist())
assert sum(p['triangles'] for p in parts)==len(mesh.faces)
(source.parent/'dragon.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print(f'Preserved {len(mesh.faces)} triangles in {len(parts)} rigid sections. SHA256 {manifest["sourceSha256"]}')
