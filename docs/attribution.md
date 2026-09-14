# Sources and attribution

## Playable dragon model

The hosted playground uses **Biocraftlab’s [Elder Fire Dragon – Flexi Toy Figure](https://www.printables.com/model/1385888-elder-fire-dragon-flexi-toy-figure)** under [Creative Commons Attribution–NonCommercial–ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/). The creator’s [listing PDF](https://media.printables.com/media/prints/1385888/pdfs/1385888-elder-fire-dragon-flexi-toy-figure-44d5651a-e864-41c7-89ef-9f5f70b9a84c.pdf) records that licence.

The included adaptation reduces 1,285,002 triangles to 120,106, combines ten axial sections into seven rigid groups, fixes the wings to the shoulders, smooths the body and wing surface detail, transforms coordinates, and adds approximate collision hulls and anchors. These adapted meshes and collision data carry the same CC BY-NC-SA 4.0 licence; see the [asset notice](../public/models/elder-fire/LICENSE.md). Credit the creator, identify changes, retain the licence, and observe its noncommercial and share-alike terms when reusing them.

## Original video model

The historical videos show the [articulated dragon on MakerWorld, model 2735519, profile 3032774](https://makerworld.com/en/models/2735519-articulated-dragon#profileId-3032774). The reference download was named `danger+dragon.stl`.

The model is by **jars_2003**. Its MakerWorld listing uses the Standard Digital File License; it is not a Creative Commons asset. The original STL, split meshes, and collision manifest are not redistributed in this repository or the Pages site. The current playable version uses the separately licensed Elder Fire model above.

The included video and poster show this model as part of the Three.js/Box3D experiment and credit the creator. They do not grant a license to the underlying model or include downloadable geometry. The project claims no ownership of the dragon design.

## Software and ideas

| Source | Used for |
| --- | --- |
| [Three.js](https://threejs.org/) · [source and license](https://github.com/mrdoob/three.js) | WebGL rendering, geometry loading, physical materials, camera controls, and spline maths |
| [Box3D documentation](https://box2d.org/documentation3d/) · [source](https://github.com/erincatto/box3d) | Erin Catto's 3D rigid-body engine |
| [box3d-wasm](https://github.com/monteslu/box3d-wasm) | Luis Montes's browser/Node WebAssembly wrapper; this project uses version 0.2.0's standard build |
| [CatmullRomCurve3](https://threejs.org/docs/#CatmullRomCurve3) | Closed centripetal spline for the head's flight target |
| [A Class of Local Interpolating Splines](https://doi.org/10.1016/B978-0-12-079050-0.50020-5) | Edwin Catmull and Raphael Rom, 1974, in *Computer Aided Geometric Design*, pp. 317–326 |
| [Trimesh](https://trimesh.org/) | STL connectivity, transformations, slicing, and export |
| [NumPy](https://numpy.org/) and [SciPy spatial](https://docs.scipy.org/doc/scipy/reference/spatial.html) | Geometry arrays, convex hulls, and half-space intersections |
| [fast-simplification](https://github.com/pyvista/fast-simplification) | Per-shell quadric mesh decimation for the Elder Fire adaptation |
| [Matplotlib](https://matplotlib.org/) | Optional local component inspection image |
| [Vite](https://vite.dev/) | Development server and static production build |
| [DM Sans](https://fonts.google.com/specimen/DM+Sans) and [Manrope](https://fonts.google.com/specimen/Manrope) | Interface fonts requested from Google Fonts |

The application source and documentation are published for this experiment without an added open-source license. Dependencies retain their own licenses. Their names and the MakerWorld link identify the tools and source material; no endorsement is implied.
