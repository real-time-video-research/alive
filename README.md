# ALIVE

**Interaction-Aligned Object Insertion for First-Frame-Guided Video Editing**

Zhenghong Zhou, Zhe Lin, Jiebo Luo, and Yuqian Zhou<br>
University of Rochester · Adobe Research

[Project page](https://real-time-video-research.github.io/alive/) · [Repository](https://github.com/real-time-video-research/alive) · [Full comparison](https://real-time-video-research.github.io/alive/comparison.html#method=all)

Make inserted objects “alive”: not merely visible, but part of the video’s world, responding to surrounding actions.

This repository contains the project website and its media. It includes 40 evaluation examples, synchronized baseline comparisons, training pairs with P0–P4 annotations, a method demonstration, and quantitative results. The paper and appendix are available on [arXiv](https://arxiv.org/abs/2610.08779). 3D-rendered evaluation samples will be released once permission is granted; the dataset section currently includes one rendered pair.

## Run locally

```bash
python -m http.server 8000
```

Open <http://localhost:8000/>. No build step or external media hosting is required.

## GitHub Pages

In **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, then save. The site will be available at <https://real-time-video-research.github.io/alive/>. The `.nojekyll` file allows the HTML, JavaScript, CSS, and media to be served directly. Subsequent pushes to `main` update the website automatically.

## Files

- `index.html`, `app.js`, `style.css`: project page.
- `comparison.html`, `comparison.js`, `comparison.css`: synchronized method comparisons.
- `data.js`: examples, prompt annotations, and result tables.
- `assets/`: method figure, branding, and image previews.
- Other media directories contain the selected videos and their preview images.
