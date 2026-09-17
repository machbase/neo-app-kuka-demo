# Dataset source

- Title: Dataset for Collaborative Robotics
- Version: 3
- DOI: https://doi.org/10.17632/4fr33dkrjt.3
- License: CC BY 4.0
- Files used: `User_1.csv` through `User_30.csv`
- Retrieved: 2026-09-15 from Mendeley Data public file endpoints

The files are retained byte-for-byte. `SHA256SUMS` records their retrieved hashes.
`scripts/seed.js` reads all 33,271 rows and converts only the seven repeated
`JointPosition` fields from degrees to radians. It preserves participant, task,
`Time/Second`, and `Time Stamp` values in the database. Demographic data and the
maze image are outside this application's scope and are not included.
