#!/usr/bin/env node
/**
 * Seed para datos de prueba E2E (Playwright).
 *
 * Crea en la base de DEV (no test):
 * - 1 Año académico ACTIVO
 * - 1 Nivel (Primaria), 1 Grado (Primero), 2 Secciones (A, B)
 * - 1 Curso (Matemática)
 * - 2 Períodos (Bimestre 1, Bimestre 2)
 * - 1 Docente con ficha y asignación a Sección A
 * - 1 Alumno matriculado en Sección A (APROBADA)
 * - 1 Apoderado vinculado al alumno (principal)
 *
 * Usuarios creados:
 * - docente1@ejemplo.edu.pe / Docente123! (DOCENTE)
 * - alumno1@ejemplo.edu.pe / Alumno123! (ALUMNO)
 * - apoderado1@ejemplo.edu.pe / Apoderado123! (APODERADO)
 *
 * Requiere variables de entorno:
 * - DATABASE_URL (base de desarrollo)
 * - JWT_SECRET
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { hashPassword } from './auth/password.js'
import { loadConfig } from './config.js'
import { getPrisma } from './db.js'
import { roleCodes, type RoleCode } from '@intranet/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../../.env')

// Cargar .env del proyecto (para seed en dev local)
if (existsSync(envPath)) {
  loadEnvFile(envPath)
}

const DEV_INSTITUCION_ID = '00000000-0000-4000-8000-000000000001'

async function main() {
  const config = loadConfig()

  if (config.NODE_ENV === 'production') {
    throw new Error('Este seed NO debe ejecutarse en producción.')
  }

  const prisma = getPrisma()

  console.log('🌱 Iniciando seed E2E en base de desarrollo...')

  // 1. Roles (upsert)
  console.log('📋 Sincronizando roles...')
  for (const codigo of roleCodes) {
    await prisma.rol.upsert({
      where: { codigo },
      create: { codigo, nombre: codigo },
      update: { nombre: codigo },
    })
  }

  // 2. Institución (ya existe por seed principal, pero aseguramos)
  await prisma.institucion.upsert({
    where: { id: DEV_INSTITUCION_ID },
    create: { id: DEV_INSTITUCION_ID, nombre: 'Institución Educativa de Ejemplo' },
    update: {},
  })

  // 3. Año académico
  console.log('📅 Creando año académico...')
  const anio = await prisma.anioAcademico.upsert({
    where: { id: '66666666-6666-4666-8666-666666666666' },
    create: {
      id: '66666666-6666-4666-8666-666666666666',
      institucionId: DEV_INSTITUCION_ID,
      nombre: '2026',
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-12-15'),
      estado: 'ACTIVO',
    },
    update: { estado: 'ACTIVO' },
  })

  // 4. Nivel, Grado, Secciones
  console.log('🏫 Creando estructura escolar...')
  const nivel = await prisma.nivel.upsert({
    where: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    create: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      institucionId: DEV_INSTITUCION_ID,
      nombre: 'Primaria',
      orden: 1,
    },
    update: {},
  })

  const grado = await prisma.grado.upsert({
    where: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    create: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      nivelId: nivel.id,
      nombre: 'Primero',
      orden: 1,
    },
    update: {},
  })

  const seccionA = await prisma.seccion.upsert({
    where: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    create: {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      gradoId: grado.id,
      anioId: anio.id,
      nombre: 'A',
    },
    update: {},
  })

  const seccionB = await prisma.seccion.upsert({
    where: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
    create: {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      gradoId: grado.id,
      anioId: anio.id,
      nombre: 'B',
    },
    update: {},
  })

  // 5. Curso
  const curso = await prisma.curso.upsert({
    where: { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
    create: {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      nivelId: nivel.id,
      nombre: 'Matemática',
      orden: 1,
    },
    update: {},
  })

  // 6. Períodos
  const periodo1 = await prisma.periodoAcademico.upsert({
    where: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
    create: {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      anioId: anio.id,
      nombre: 'Bimestre 1',
      orden: 1,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-05-31'),
      estado: 'ACTIVO',
    },
    update: { estado: 'ACTIVO' },
  })

  const periodo2 = await prisma.periodoAcademico.upsert({
    where: { id: 'gggggggg-gggg-4ggg-8ggg-gggggggggggg' },
    create: {
      id: 'gggggggg-gggg-4ggg-8ggg-gggggggggggg',
      anioId: anio.id,
      nombre: 'Bimestre 2',
      orden: 2,
      fechaInicio: new Date('2026-06-01'),
      fechaFin: new Date('2026-08-31'),
      estado: 'PLANIFICADO',
    },
    update: {},
  })

  // 7. Helper: crear usuario con rol
  async function crearUsuarioConRol(
    username: string,
    email: string,
    password: string,
    nombres: string,
    apellidos: string,
    documento: string,
    rol: RoleCode,
  ) {
    const passwordHash = await hashPassword(password)

    // Persona (upsert por documento)
    const persona = await prisma.persona.upsert({
      where: { tipoDocumento_numeroDocumento: { tipoDocumento: 'DNI', numeroDocumento: documento } },
      create: {
        nombres,
        apellidos,
        tipoDocumento: 'DNI',
        numeroDocumento: documento,
      },
      update: { nombres, apellidos },
    })

    // Usuario
    const usuario = await prisma.usuario.upsert({
      where: { username },
      create: {
        username,
        email,
        passwordHash,
        debeCambiarPassword: false,
        personaId: persona.id,
      },
      update: { passwordHash, debeCambiarPassword: false, personaId: persona.id },
    })

    // Rol
    const rolRecord = await prisma.rol.findUniqueOrThrow({ where: { codigo: rol } })
    await prisma.usuarioRol.upsert({
      where: { usuarioId_rolId: { usuarioId: usuario.id, rolId: rolRecord.id } },
      create: { usuarioId: usuario.id, rolId: rolRecord.id },
      update: {},
    })

    return { usuario, persona }
  }

  // 8. Docente (con ficha y asignación)
  console.log('👨‍🏫 Creando docente...')
  const { persona: personaDocente } = await crearUsuarioConRol(
    'docente1',
    'docente1@ejemplo.edu.pe',
    'Docente123!',
    'Carlos',
    'Pérez García',
    '11111111',
    'DOCENTE',
  )

  const fichaDocente = await prisma.docente.upsert({
    where: { personaId: personaDocente.id },
    create: { personaId: personaDocente.id, codigoDocente: 'DOC-001' },
    update: { codigoDocente: 'DOC-001' },
  })

  await prisma.asignacionDocente.upsert({
    where: {
      docenteId_cursoId_seccionId_anioId: {
        docenteId: fichaDocente.id,
        cursoId: curso.id,
        seccionId: seccionA.id,
        anioId: anio.id,
      },
    },
    create: {
      docenteId: fichaDocente.id,
      cursoId: curso.id,
      seccionId: seccionA.id,
      anioId: anio.id,
      esTutor: true,
    },
    update: { esTutor: true },
  })

  // 9. Alumno (con matrícula APROBADA en Sección A)
  console.log('👨‍🎓 Creando alumno...')
  const { persona: personaAlumno } = await crearUsuarioConRol(
    'alumno1',
    'alumno1@ejemplo.edu.pe',
    'Alumno123!',
    'María',
    'López Torres',
    '22222222',
    'ALUMNO',
  )

  const fichaAlumno = await prisma.alumno.upsert({
    where: { personaId: personaAlumno.id },
    create: { personaId: personaAlumno.id, codigoAlumno: 'AL-001' },
    update: { codigoAlumno: 'AL-001' },
  })

  await prisma.matricula.upsert({
    where: {
      alumnoId_anioId: {
        alumnoId: fichaAlumno.id,
        anioId: anio.id,
      },
    },
    create: {
      alumnoId: fichaAlumno.id,
      anioId: anio.id,
      seccionId: seccionA.id,
      estado: 'APROBADA',
    },
    update: { estado: 'APROBADA', seccionId: seccionA.id },
  })

  // 10. Director (para flujos administrativos)
  console.log('👨‍💼 Creando director...')
  await crearUsuarioConRol(
    'director1',
    'director1@ejemplo.edu.pe',
    'Director123!',
    'Roberto',
    'Gómez Sánchez',
    '44444444',
    'DIRECTOR',
  )

  // 11. Apoderado (vinculado al alumno, principal)
  console.log('👨‍👩‍👧 Creando apoderado...')
  const { persona: personaApoderado } = await crearUsuarioConRol(
    'apoderado1',
    'apoderado1@ejemplo.edu.pe',
    'Apoderado123!',
    'Ana',
    'Torres Vega',
    '33333333',
    'APODERADO',
  )

  const fichaApoderado = await prisma.apoderado.upsert({
    where: { personaId: personaApoderado.id },
    create: { personaId: personaApoderado.id },
    update: {},
  })

  await prisma.apoderadoAlumno.upsert({
    where: {
      apoderadoId_alumnoId: {
        apoderadoId: fichaApoderado.id,
        alumnoId: fichaAlumno.id,
      },
    },
    create: {
      apoderadoId: fichaApoderado.id,
      alumnoId: fichaAlumno.id,
      parentesco: 'Madre',
      esPrincipal: true,
    },
    update: { esPrincipal: true },
  })

  console.log('✅ Seed E2E completado exitosamente')
  console.log('')
  console.log('📋 Datos creados:')
  console.log(`   Año académico: ${anio.id} (${anio.nombre})`)
  console.log(`   Sección A: ${seccionA.id} (Grado ${grado.nombre} ${seccionA.nombre})`)
  console.log(`   Sección B: ${seccionB.id}`)
  console.log(`   Curso: ${curso.id} (${curso.nombre})`)
  console.log(`   Período 1: ${periodo1.id} (${periodo1.nombre})`)
  console.log(`   Período 2: ${periodo2.id} (${periodo2.nombre})`)
  console.log('')
  console.log('👥 Usuarios de prueba:')
  console.log('   Director:  director1@ejemplo.edu.pe / Director123! (acceso administrativo completo)')
  console.log('   Docente:   docente1@ejemplo.edu.pe / Docente123! (asignado a Sección A, Curso Matemática)')
  console.log('   Alumno:    alumno1@ejemplo.edu.pe / Alumno123! (matriculado en Sección A, APROBADA)')
  console.log('   Apoderado: apoderado1@ejemplo.edu.pe / Apoderado123! (vinculado a alumno, principal)')
  console.log('')
  console.log('🔧 Para E2E: usa anioId =', anio.id)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('❌ Error en seed E2E:', err)
  process.exit(1)
})