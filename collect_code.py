import os

# --- CONFIGURACIÓN DEL SCRIPT ---
# Lista de los archivos y carpetas que quieres recopilar.
# Puedes añadir o quitar los que necesites.
# Las carpetas se buscarán recursivamente (todos sus archivos).
ARCHIVOS_A_RECOPILAR = [
    "package.json",
    "vite.config.js",
    "src/",  # Carpeta "src" completa
    ".env.local", # Tu archivo de variables de entorno
    # "otra_carpeta/otro_archivo.js", # Ejemplo de otro archivo
]

# Nombre del archivo de salida donde se guardará todo el código.
ARCHIVO_SALIDA = "codigo_proyecto.txt"
# --- FIN DE LA CONFIGURACIÓN ---

def collect_files_content(root_dir, files_to_collect, output_file):
    """
    Recopila el contenido de los archivos y carpetas especificados
    y los guarda en un único archivo de texto.
    """
    print(f"Iniciando la recopilación de archivos en: {root_dir}")
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for item in files_to_collect:
            item_path = os.path.join(root_dir, item)

            if os.path.isfile(item_path):
                # Es un archivo
                print(f"  Recopilando archivo: {item}")
                outfile.write(f"--- INICIO DEL ARCHIVO: {item} ---\n")
                try:
                    with open(item_path, 'r', encoding='utf-8') as infile:
                        outfile.write(infile.read())
                    outfile.write(f"\n--- FIN DEL ARCHIVO: {item} ---\n\n")
                except Exception as e:
                    outfile.write(f"\n--- ERROR AL LEER EL ARCHIVO: {item} - {e} ---\n\n")
            
            elif os.path.isdir(item_path):
                # Es una carpeta, la recorremos recursivamente
                print(f"  Recopilando contenido de la carpeta: {item}")
                for dirpath, _, filenames in os.walk(item_path):
                    for f in filenames:
                        file_path = os.path.join(dirpath, f)
                        relative_path = os.path.relpath(file_path, root_dir)
                        print(f"    - Recopilando: {relative_path}")
                        outfile.write(f"--- INICIO DEL ARCHIVO: {relative_path} ---\n")
                        try:
                            with open(file_path, 'r', encoding='utf-8') as infile:
                                outfile.write(infile.read())
                            outfile.write(f"\n--- FIN DEL ARCHIVO: {relative_path} ---\n\n")
                        except Exception as e:
                            outfile.write(f"\n--- ERROR AL LEER EL ARCHIVO: {relative_path} - {e} ---\n\n")
            else:
                print(f"  [ADVERTENCIA] Elemento no encontrado (archivo o carpeta): {item}")

    print(f"\nRecopilación completada. Contenido guardado en '{output_file}'")

if __name__ == "__main__":
    # La raíz del proyecto es donde se ejecuta este script
    project_root = os.path.dirname(os.path.abspath(__file__))
    collect_files_content(project_root, ARCHIVOS_A_RECOPILAR, ARCHIVO_SALIDA)