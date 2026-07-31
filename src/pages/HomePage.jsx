import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-sillar-50 flex flex-col items-center justify-center px-6 font-sans text-center">
      <h1 className="text-2xl font-display font-medium mb-2">CitaFácil</h1>
      <p className="text-tinta/60 mb-6 max-w-xs">
        Agenda, recordatorios y pagos para consultorios independientes.
      </p>
      <Link to="/login" className="text-sm bg-salvia-600 text-white px-4 py-2.5 rounded-lg">
        Ingresar a mi consultorio
      </Link>
      <Link to="/registro" className="text-sm text-tinta/60 underline mt-3">
        Registrar un nuevo consultorio
      </Link>
    </div>
  )
}
