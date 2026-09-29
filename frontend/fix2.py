import pathlib

p = pathlib.Path('src/App.tsx')
c = p.read_text(encoding='utf-8')

old_1 = '<div className="flex items-center gap-3">'
new_1 = '<div className="flex min-w-0 flex-1 items-center gap-3">'

old_2 = '<div className="pravaah-mark" aria-hidden="true">'
new_2 = '<div className="pravaah-mark shrink-0" aria-hidden="true">'

old_3 = '<div className={`pravaah-wordmark ${light ? "text-white" : "text-slate-900"}`}>PRAVAAH</div>'
new_3 = '<div className={`pravaah-wordmark truncate ${light ? "text-white" : "text-slate-900"}`}>PRAVAAH</div>'

old_4 = '<div className={`pravaah-tagline ${light ? "text-slate-400" : "text-slate-500"}`}>'
new_4 = '<div className={`pravaah-tagline truncate ${light ? "text-slate-400" : "text-slate-500"}`}>'

c = c.replace(old_1, new_1)
c = c.replace(old_2, new_2)
c = c.replace(old_3, new_3)
c = c.replace(old_4, new_4)

p.write_text(c, encoding='utf-8')
