import { readFile } from 'node:fs/promises'
import * as core from '@actions/core'
import { glob } from 'glob'
import { createValidator } from '@deconz-community/ddf-validator'
import { ZodError } from 'zod'
import { visit } from 'jsonc-parser'
import { version } from './package.json'

function handleError(error: ZodError | Error | unknown, file: string, data: string) {
  if (error instanceof ZodError) {
    // Build error list by path
    const errors: Record<string, string[]> = {}
    error.issues.forEach((issue) => {
      const path = issue.path.join('/')
      if (Array.isArray(errors[path]))
        errors[path].push(issue.message)
      else
        errors[path] = [issue.message]
    })

    const paths = Object.keys(errors)

    visit(data, {
      onLiteralValue: (value: any, offset: number, length: number, startLine: number, startCharacter: number, pathSupplier) => {
        const path = pathSupplier().join('/')
        const index = paths.indexOf(path)
        if (index > -1) {
          core.error(`${errors[path].length} validation error${errors[path].length > 1 ? 's' : ''} in file ${file} at ${path}`)
          errors[path].forEach((message) => {
            core.error(message, {
              file,
              startLine,
              startColumn: startCharacter,
            })
          })
          paths.splice(index, 1)
        }
      },
    })

    if (paths.length > 0) {
      paths.forEach((path) => {
        core.error(`${errors[path].length} validation error${errors[path].length > 1 ? 's' : ''} in file ${file} at ${path}`)
        errors[path].forEach((message) => {
          core.error(message, {
            file,
          })
        })
      })
    }
  }
  else if (error instanceof Error) {
    core.error(error.message, {
      file,
    })
  }
  else {
    core.error('Unknown Error')
  }
}

async function run(): Promise<void> {
  try {
    const validator = createValidator()

    core.info(`Validatig DDF using GitHub action v${version} and validator v${validator.version}.`)

    // Load generic files
    let genericErrorCount = 0
    const genericDirectory = core.getInput('generic')
      ? `${core.getInput('generic')}/${core.getInput('search')}`
      : `${core.getInput('directory')}/generic/${core.getInput('search')}`

    core.info(`Loading generic files from ${genericDirectory}`)

    const genericFilePaths = await glob(genericDirectory)

    if (genericFilePaths.length === 0)
      throw new Error('No generic files found. Please check the settings.')

    core.debug(`Found ${genericFilePaths.length} files.`)

    // Load and sort files by schema
    const genericfiles: Record<string, { path: string; raw: string; data: unknown }[]> = {
      'constants1.schema.json': [],
      'constants2.schema.json': [],
      'resourceitem1.schema.json': [],
      'subdevice1.schema.json': [],
    }

    for (const filePath of genericFilePaths) {
      core.debug(`Loading ${filePath}.`)
      try {
        const data = await readFile(filePath, 'utf-8')
        const decoded = JSON.parse(data)
        if (typeof decoded.schema === 'string' || genericfiles[decoded.schema] === undefined) {
          genericfiles[decoded.schema].push({
            path: filePath,
            raw: data,
            data: decoded,
          })
        }
        else { core.error(`${filePath}:Unknown schema ${decoded.schema}`) }
      }
      catch (error) {
        genericErrorCount++
        if (error instanceof Error)
          core.error(`${filePath}: ${error.message}`)
        else
          core.error(`${filePath}: Unknown Error`)
      }
    }

    // Validating files
    for (const [domain, files] of Object.entries(genericfiles)) {
      core.info(`Loading ${genericfiles[domain].length} files with schema "${domain}".`)
      for (const file of files) {
        core.debug(`Validating ${file.path}...`)
        try {
          validator.loadGeneric(file.data)
          core.debug(`Validating ${file.path}. OK`)
        }
        catch (error) {
          genericErrorCount++
          handleError(error, file.path, file.raw)
        }
      }
    }

    core.info(`Loaded ${genericFilePaths.length - genericErrorCount} files.`)
    if (genericErrorCount > 0)
      core.warning(`${genericErrorCount} files was not loaded because of errors.`)

    // Validate DDF files
    let ddfErrorCount = 0
    const ddfDirectory = `${core.getInput('directory')}/${core.getInput('search')}`

    core.info(`Validating DDF files from ${ddfDirectory} (ignore: ${core.getInput('ignore')})`)

    const inputFiles = await glob(ddfDirectory, {
      ignore: core.getInput('ignore'),
    })

    if (inputFiles.length === 0)
      throw new Error('No files found. Please check the settings.')

    core.info(`Found ${inputFiles.length} files to valiate.`)

    for (const file of inputFiles) {
      let data = ''
      try {
        data = await readFile(file, 'utf-8')
        const decoded = JSON.parse(data)
        validator.validate(decoded)
      }
      catch (error) {
        ddfErrorCount++
        handleError(error, file, data)
      }
    }

    if ((genericErrorCount + ddfErrorCount) > 0)
      core.setFailed(`Found ${genericErrorCount + ddfErrorCount} invalid files. Check logs for details.`)
    else
      core.info('All files passed.')
  }
  catch (error) {
    if (error instanceof Error)
      core.setFailed(error.message)
  }
}

run()
