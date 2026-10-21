"""Font lists for training and the held-out test. R&D only.

Fonts are used to draw training images on this machine; no font file and no image ships. The
test fonts are never seen in training, so the test measures text in faces the model has not met.
"""
import os

WIN = "C:/Windows/Fonts/"
USER = os.path.expanduser("~/AppData/Local/Microsoft/Windows/Fonts/")
try:
    import matplotlib  # research only: its bundled DejaVu faces
    MPL = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data", "fonts", "ttf") + "/"
except ImportError:
    MPL = ""

TRAIN = [WIN + f for f in [
    "arial.ttf", "arialbd.ttf", "ariali.ttf", "segoeui.ttf", "segoeuib.ttf", "segoeuisl.ttf", "seguisb.ttf",
    "segoeuii.ttf", "calibri.ttf", "calibrib.ttf", "calibril.ttf", "verdana.ttf", "verdanab.ttf", "tahoma.ttf",
    "tahomabd.ttf", "times.ttf", "timesbd.ttf", "timesi.ttf", "georgia.ttf", "georgiab.ttf", "cour.ttf",
    "consola.ttf", "consolab.ttf", "corbel.ttf", "corbelb.ttf", "constan.ttf", "cambriab.ttf", "pala.ttf",
    "micross.ttf", "SamsungOneUILatin-500_v1.1.ttf", "SamsungOneUILatin-700_v1.1.ttf", "bahnschrift.ttf",
    "LeelawUI.ttf", "LeelaUIb.ttf", "ebrima.ttf", "gadugi.ttf", "gadugib.ttf", "NanumBarunGothic.ttf",
    "malgun.ttf", "framd.ttf", "seguibl.ttf", "lucon.ttf", "sylfaen.ttf", "comic.ttf", "impact.ttf",
]] + [MPL + f for f in ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSerif.ttf", "DejaVuSansMono.ttf", "DejaVuSans-Oblique.ttf"]]

# Never used in training.
TEST = [WIN + f for f in ["LatoWeb-Regular.ttf", "LatoWeb-Bold.ttf", "trebuc.ttf", "trebucbd.ttf", "Candara.ttf", "Candarab.ttf"]] + [
    USER + f for f in ["hanken-grotesk-regular.ttf", "hanken-grotesk-semibold.ttf", "conso-regular.ttf"]]

# CSS families for the browser-rendered test pages: held-out faces, and the system UI faces that
# platforms fall back to (seen in training, but drawn by the browser's own rasteriser).
CSS_TEST = ["Lato Web", "Trebuchet MS", "Candara", "Hanken Grotesk", "Conso"]
CSS_UI = ["Segoe UI", "Arial", "Verdana", "Georgia", "Tahoma"]

def available(paths):
    return [p for p in paths if os.path.exists(p)]
