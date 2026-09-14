"""Prepare Biocraftlab's Elder Fire Dragon for the seven-body playground.

Usage: python scripts/prepare-elder-fire.py /path/to/source.stl
Requires numpy, scipy, trimesh and fast-simplification; see requirements-model.txt.
Source and adapted meshes: CC BY-NC-SA 4.0, credit Biocraftlab.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import trimesh
from scipy.spatial import ConvexHull, HalfspaceIntersection, cKDTree

MODEL_URL = 'https://www.printables.com/model/1385888-elder-fire-dragon-flexi-toy-figure'
SCALE = .052
BODY_SHELLS = [4, 12, 3, 2, 5, 6, 13, 19, 11, 37]
BODY_GROUPS = [0, 1, 1, 2, 3, 4, 4, 5, 5, 6]
NAMES = ['Head', 'Shoulders & wings', 'Torso', 'Hind legs', 'Tail base', 'Tail middle', 'Tail tip']
SLUGS = ['head', 'shoulders-wings', 'torso', 'hind-legs', 'tail-base', 'tail-middle', 'tail-tip']
FOOT_SHELLS = {9: 1, 10: 1, 7: 3, 8: 3}
# Reviewed on the source component map. The leading panels (33/34) extend
# ahead of the shoulder region: a position cutoff misassigns them to the head.
# Include the small hinge pins and stray wing-surface triangles as well.
WING_SHELLS = {
    0, 1, 16, 17, 22, 23, 25, 26, 29, 30, 33, 34, 35, 36,
    41, 42, 43, 44, 45, 46, 49, 50, 51, 52, 55, 56, 57, 58, 59, 60,
    78, 79, 80, 81, 82, 83, 84, 85,
}

def convert(vertices):
    v = np.asarray(vertices)
    return np.column_stack(((v[:, 1] - 48) * SCALE, v[:, 2] * SCALE, v[:, 0] * SCALE))

def enclosing_hull(vertices, padding=.008):
    vertices = np.asarray(vertices)
    normals = ConvexHull(vertices).equations[:, :3]
    chosen = list(np.concatenate([np.eye(3), -np.eye(3)]))
    for _ in range(12):
        distance = ((normals[:, None] - np.array(chosen)[None]) ** 2).sum(axis=2).min(axis=1)
        chosen.append(normals[int(np.argmax(distance))])
    directions = np.asarray(chosen)
    support = (vertices @ directions.T).max(axis=0) + padding
    points = HalfspaceIntersection(np.column_stack([directions, -support]), vertices.mean(axis=0)).intersections
    assert len(points) <= 32
    return points.tolist()

def cells(mesh, divisions):
    from itertools import product
    bounds = mesh.bounds
    cuts = [np.linspace(bounds[0, axis], bounds[1, axis], count + 1) for axis, count in enumerate(divisions)]
    hulls = []
    for cell in product(*(range(count) for count in divisions)):
        vertices, faces = mesh.vertices, mesh.faces
        for axis in range(3):
            for side in (1, -1):
                origin = np.zeros(3); normal = np.zeros(3)
                origin[axis] = cuts[axis][cell[axis] + (side < 0)]; normal[axis] = side
                vertices, faces, _ = trimesh.intersections.slice_faces_plane(vertices, faces, normal, origin)
                if not len(faces): break
            if not len(faces): break
        if not len(faces): continue
        vertices = vertices[np.unique(faces)]
        if len(vertices) >= 4 and np.linalg.matrix_rank(vertices - vertices.mean(axis=0), tol=1e-6) == 3:
            hulls.append(enclosing_hull(vertices))
    return hulls

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path('public/models/elder-fire'))
    parser.add_argument('--triangles', type=int, default=120000)
    args = parser.parse_args()
    source_bytes = args.source.read_bytes()
    if hashlib.sha256(source_bytes).hexdigest() != '806fe02ccc02b2fcd39822e8e42cab209b01781f5d306517b64b8ea5c04f4280':
        raise ValueError('Source STL differs from the reviewed Elder Fire revision; recheck grouping before adapting it.')
    if args.triangles < 1000:
        raise ValueError('Triangle budget must be at least 1000.')
    mesh = trimesh.load(args.source, force='mesh')
    shells = sorted(mesh.split(only_watertight=False, repair=False), key=lambda p: len(p.faces), reverse=True)
    if len(mesh.faces) != 1285002 or len(shells) != 86:
        raise ValueError('This grouping is for the reviewed Elder Fire STL (1,285,002 triangles / 86 shells).')
    trees = [cKDTree(shells[i].vertices) for i in BODY_SHELLS]
    groups = [[] for _ in range(7)]
    owners = {}
    base_owners = dict(zip(BODY_SHELLS, BODY_GROUPS))
    wing_shells = sorted(WING_SHELLS)
    simplified = {}
    collision_meshes = {}
    for index, shell in enumerate(shells):
        if index in base_owners:
            owner = base_owners[index]
        elif index in FOOT_SHELLS:
            owner = FOOT_SHELLS[index]
        elif index in WING_SHELLS:
            owner = 1
        else:
            sample = shell.vertices[::max(1, len(shell.vertices) // 200)]
            distance = [np.median(tree.query(sample)[0]) for tree in trees]
            owner = BODY_GROUPS[int(np.argmin(distance))]
        owners[index] = owner
        target = min(len(shell.faces), max(24, round(args.triangles * len(shell.faces) / len(mesh.faces))))
        part = shell.simplify_quadric_decimation(face_count=target) if target < len(shell.faces) else shell.copy()
        # Keep the established mass/anchor reference independent of surface polish.
        collision_meshes[index] = part.copy()
        collision_meshes[index].vertices = convert(part.vertices)
        if owner != 0 and len(part.faces) > 100:
            original = part.vertices.copy()
            trimesh.smoothing.filter_humphrey(part, alpha=.015, beta=.7, iterations=40)
            displacement = part.vertices - original
            # Source units are millimetres. Preserve the broad silhouette and
            # print-joint gaps while reducing the small ridges on each shell.
            limit = .7 if index in WING_SHELLS else 1.2
            lengths = np.linalg.norm(displacement, axis=1)
            displacement *= np.minimum(1, limit / np.maximum(lengths, 1e-12))[:, None]
            part.vertices = original + displacement
        part.vertices = convert(part.vertices)
        simplified[index] = part
        groups[owner].append(part)
    assert sum(len(shells[i].faces) for i in owners) == len(mesh.faces)
    args.output.mkdir(parents=True, exist_ok=True)
    parts = []
    for index, group in enumerate(groups):
        part = trimesh.util.concatenate(group)
        # Keep physics centers on the axial body, not shifted into the wide wings.
        core_ids = [i for i, owner in base_owners.items() if owner == index]
        core = trimesh.util.concatenate([collision_meshes[i] for i in core_ids])
        center = core.bounds.mean(axis=0)
        part.vertices -= center
        core.vertices -= center
        filename = SLUGS[index] + '.stl'
        part.export(args.output / filename)
        record = dict(name=NAMES[index], file=filename, center=center.tolist(), bounds=part.bounds.tolist(),
                      triangles=len(part.faces), hull=enclosing_hull(core.vertices),
                      sha256=hashlib.sha256((args.output / filename).read_bytes()).hexdigest())
        if index == 0:
            record['headContactHulls'] = cells(part, (3, 2, 3))
        foot_hulls = []
        for shell_id, owner in FOOT_SHELLS.items():
            if owner == index:
                foot = simplified[shell_id].copy(); foot.vertices -= center
                foot_hulls.extend(cells(foot, (2, 1, 1)))
        if foot_hulls: record['footHulls'] = foot_hulls
        if index == 1:
            # Separate massless wing contacts avoid an enormous convex torso/mass.
            record['floorHulls'] = []
            for side in (-1, 1):
                wing = trimesh.util.concatenate([simplified[i] for i in wing_shells if shells[i].bounds.mean(axis=0)[0] * side > 0])
                wing.vertices -= center
                record['floorHulls'].extend(cells(wing, (3, 1, 2)))
        parts.append(record)
    # Centers of the existing print-in-place connections retained by the seven groups.
    anchors_source = [[0, -27.8, 8], [0, 19.4, 10], [0, 47, 10], [0, 73.5, 8], [0, 111, 6], [0, 149.5, 4]]
    manifest = dict(model='elder-fire', creator='Biocraftlab', sourceUrl=MODEL_URL,
                    license='CC-BY-NC-SA-4.0', licenseUrl='https://creativecommons.org/licenses/by-nc-sa/4.0/',
                    sourceSha256=hashlib.sha256(source_bytes).hexdigest(), sourceTriangles=len(mesh.faces),
                    triangles=sum(p['triangles'] for p in parts), scale=SCALE, parts=parts,
                    anchors=convert(anchors_source).tolist(),
                    modifications='Simplified meshes, seven rigid groups, fixed wings, smoothed body, wing and foot surfaces, transformed coordinates and approximate collision hulls.')
    (args.output / 'dragon.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    print(json.dumps({'triangles':manifest['triangles'], 'stlBytes':sum((args.output / p['file']).stat().st_size for p in parts),
                      'parts':[{'name':p['name'],'triangles':p['triangles']} for p in parts]}, indent=2))

if __name__ == '__main__':
    main()
