import { readFile } from 'node:fs/promises'
import * as core from '@actions/core'
import { glob } from 'glob'
import { fromZodError } from 'zod-validation-error'
import { createValidator } from '@deconz-community/ddf-validator'
import { ZodError } from 'zod'

async function run(): Promise<void> {
  try {
    const validator = createValidator()

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
    const genericfiles: Record<string, { path: string; data: unknown }[]> = {
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
          if (error instanceof ZodError)
            core.error(`${file.path}:${fromZodError(error).message}`)
          else if (error instanceof Error)
            core.error(error.message)
          else
            core.error('Unknown Error')
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
      try {
        const data = await readFile(file, 'utf-8')
        const decoded = JSON.parse(data)
        validator.validate(decoded)
      }
      catch (error) {
        ddfErrorCount++
        if (error instanceof ZodError) {
          // Build error list by path
          const errors: Record<string, string[]> = {}
          error.issues.forEach((issue) => {
            if (Array.isArray(errors[issue.path.join('/')]))
              errors[issue.path.join('/')].push(issue.message)
            else
              errors[issue.path.join('/')] = [issue.message]
          })

          core.startGroup(`Error while parsing ${file}`)

          for (let i = 0; i < error.issues.length; i++) {
            const issue = error.issues[i]

            const path = issue.path.join('/')

            if (path !== 'subdevices/0/items/0/name')
              return

            core.error(issue.message, {
              file,
              startLine: 18 + 1,
              // startColumn: 20,

              // title: issue.message,
              // endLine: 18 + 1,
              // endColumn: 42,

            })

            const clone = structuredClone(error)
            clone.issues = [issue]
            core.error(`${file}\n${fromZodError(clone).message}`, {
              file,
              title: issue.message,
              startLine: 18 + 1,
              // startColumn: 20,

              // title: issue.message,
              // endLine: 18 + 1,
              // endColumn: 42,

            })

            core.error('An other error', {
              file,
              startLine: 18 + 1,
              // startColumn: 20,

              // title: issue.message,
              // endLine: 18 + 1,
              // endColumn: 42,

            })
            // core.error(issue.path.join('/'))
          }

          core.endGroup()

          // core.error(error)
          /*
          core.error(`${file}:${fromZodError(error).message}`, {
            file,

          })
          */
        }

        else if (error instanceof Error) {
          core.error(error.message)
        }
        else {
          core.error('Unknown Error')
        }
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
