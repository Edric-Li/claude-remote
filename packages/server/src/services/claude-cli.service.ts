import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ClaudeOptions {
  sessionId?: string;
  projectPath?: string;
  cwd?: string;
  resume?: boolean;
  toolsSettings?: {
    allowedTools?: string[];
    disallowedTools?: string[];
    skipPermissions?: boolean;
  };
  permissionMode?: string;
  images?: Array<{
    name: string;
    data: string; // base64 data URL
    size: number;
    mimeType: string;
  }>;
}

export interface ClaudeMessage {
  type: 'claude-response' | 'claude-output' | 'claude-error' | 'claude-complete' | 'session-created' | 'session-aborted';
  data?: any;
  error?: string;
  exitCode?: number;
  sessionId?: string;
  success?: boolean;
  isNewSession?: boolean;
}

@Injectable()
export class ClaudeCliService {
  private readonly logger = new Logger(ClaudeCliService.name);
  private activeProcesses = new Map<string, ChildProcess>();

  async spawnClaude(
    command: string,
    options: ClaudeOptions = {},
    messageCallback: (message: ClaudeMessage) => void
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const { sessionId, projectPath, cwd, resume, toolsSettings, permissionMode, images } = options;
      let capturedSessionId = sessionId;
      let sessionCreatedSent = false;

      // Use tools settings passed from frontend, or defaults
      const settings = toolsSettings || {
        allowedTools: [],
        disallowedTools: [],
        skipPermissions: false
      };

      // Build Claude CLI command - start with print/resume flags first
      const args: string[] = [];

      // Add print flag with command if we have a command
      if (command && command.trim()) {
        args.push('--print');
        args.push(command);
      }

      // Use cwd (actual project directory) instead of projectPath (Claude's metadata directory)
      const workingDir = cwd || process.cwd();

      // Handle images by saving them to temporary files and passing paths to Claude
      const tempImagePaths: string[] = [];
      let tempDir: string | null = null;
      
      if (images && images.length > 0) {
        try {
          // Create temp directory in the project directory so Claude can access it
          tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
          await fs.mkdir(tempDir, { recursive: true });

          // Save each image to a temp file
          for (const [index, image] of images.entries()) {
            // Extract base64 data and mime type
            const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
              this.logger.error('Invalid image data format');
              continue;
            }

            const [, mimeType, base64Data] = matches;
            const extension = mimeType.split('/')[1] || 'png';
            const filename = `image_${index}.${extension}`;
            const filepath = path.join(tempDir, filename);

            // Write base64 data to file
            await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
            tempImagePaths.push(filepath);
          }

          // Include the full image paths in the prompt for Claude to reference
          if (tempImagePaths.length > 0 && command && command.trim()) {
            const imageNote = `\n\n[Images provided at the following paths:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
            const modifiedCommand = command + imageNote;

            // Update the command in args
            const printIndex = args.indexOf('--print');
            if (printIndex !== -1 && printIndex + 1 < args.length && args[printIndex + 1] === command) {
              args[printIndex + 1] = modifiedCommand;
            }
          }
        } catch (error) {
          this.logger.error('Error processing images for Claude:', error);
        }
      }

      // Add resume flag if resuming
      if (resume && sessionId) {
        args.push('--resume', sessionId);
      }

      // Add basic flags
      args.push('--output-format', 'stream-json', '--verbose');

      // Add MCP config flag only if MCP servers are configured
      try {
        this.logger.log('🔍 Starting MCP config check...');
        
        // Check for MCP config in ~/.claude.json
        const claudeConfigPath = path.join(os.homedir(), '.claude.json');
        
        this.logger.log(`🔍 Checking for MCP configs in: ${claudeConfigPath}`);
        
        let hasMcpServers = false;

        // Check Claude config for MCP servers
        try {
          const claudeConfigContent = await fs.readFile(claudeConfigPath, 'utf8');
          const claudeConfig = JSON.parse(claudeConfigContent);

          // Check global MCP servers
          if (claudeConfig.mcpServers && Object.keys(claudeConfig.mcpServers).length > 0) {
            this.logger.log(`✅ Found ${Object.keys(claudeConfig.mcpServers).length} global MCP servers`);
            hasMcpServers = true;
          }

          // Check project-specific MCP servers
          if (!hasMcpServers && claudeConfig.claudeProjects) {
            const currentProjectPath = process.cwd();
            const projectConfig = claudeConfig.claudeProjects[currentProjectPath];
            if (projectConfig && projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0) {
              this.logger.log(`✅ Found ${Object.keys(projectConfig.mcpServers).length} project MCP servers`);
              hasMcpServers = true;
            }
          }
        } catch (e) {
          this.logger.log(`ℹ️ Claude config not found or invalid at: ${claudeConfigPath}`);
        }

        this.logger.log(`🔍 hasMcpServers result: ${hasMcpServers}`);

        if (hasMcpServers) {
          this.logger.log(`📡 Adding MCP config: ${claudeConfigPath}`);
          args.push('--mcp-config', claudeConfigPath);
        }
      } catch (error) {
        this.logger.log('❌ MCP config check failed:', error.message);
        this.logger.log('Note: MCP config check failed, proceeding without MCP support');
      }

      // Add model for new sessions
      if (!resume) {
        args.push('--model', 'sonnet');
      }

      // Add permission mode if specified
      if (permissionMode && permissionMode !== 'default') {
        args.push('--permission-mode', permissionMode);
        this.logger.log('🔒 Using permission mode:', permissionMode);
      }

      // Add tools settings flags
      if (settings.skipPermissions && permissionMode !== 'plan') {
        args.push('--dangerously-skip-permissions');
        this.logger.log('⚠️  Using --dangerously-skip-permissions (skipping other tool settings)');
      } else {
        // Collect all allowed tools, including plan mode defaults
        let allowedTools = [...(settings.allowedTools || [])];

        // Add plan mode specific tools
        if (permissionMode === 'plan') {
          const planModeTools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite'];
          for (const tool of planModeTools) {
            if (!allowedTools.includes(tool)) {
              allowedTools.push(tool);
            }
          }
          this.logger.log('📝 Plan mode: Added default allowed tools:', planModeTools);
        }

        // Add allowed tools
        if (allowedTools.length > 0) {
          for (const tool of allowedTools) {
            args.push('--allowedTools', tool);
            this.logger.log('✅ Allowing tool:', tool);
          }
        }

        // Add disallowed tools
        if (settings.disallowedTools && settings.disallowedTools.length > 0) {
          for (const tool of settings.disallowedTools) {
            args.push('--disallowedTools', tool);
            this.logger.log('❌ Disallowing tool:', tool);
          }
        }
      }

      this.logger.log('Spawning Claude CLI:', 'claude', args.map(arg => {
        const cleanArg = arg.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        return cleanArg.includes(' ') ? `"${cleanArg}"` : cleanArg;
      }).join(' '));
      this.logger.log('Working directory:', workingDir);
      this.logger.log('Session info - Input sessionId:', sessionId, 'Resume:', resume);

      const claudeProcess = spawn('claude', args, {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      // Store process reference for potential abort
      const processKey = capturedSessionId || sessionId || Date.now().toString();
      this.activeProcesses.set(processKey, claudeProcess);

      // Handle stdout (streaming JSON responses)
      claudeProcess.stdout.on('data', (data) => {
        const rawOutput = data.toString();
        this.logger.log('📤 Claude CLI stdout:', rawOutput);

        const lines = rawOutput.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            this.logger.log('📄 Parsed JSON response:', response);

            // Capture session ID if it's in the response
            if (response.session_id && !capturedSessionId) {
              capturedSessionId = response.session_id;
              this.logger.log('📝 Captured session ID:', capturedSessionId);

              // Update process key with captured session ID
              if (processKey !== capturedSessionId) {
                this.activeProcesses.delete(processKey);
                this.activeProcesses.set(capturedSessionId, claudeProcess);
              }

              // Send session-created event only once for new sessions
              if (!sessionId && !sessionCreatedSent) {
                sessionCreatedSent = true;
                messageCallback({
                  type: 'session-created',
                  sessionId: capturedSessionId
                });
              }
            }

            // Send parsed response
            messageCallback({
              type: 'claude-response',
              data: response
            });
          } catch (parseError) {
            this.logger.log('📄 Non-JSON response:', line);
            // If not JSON, send as raw text
            messageCallback({
              type: 'claude-output',
              data: line
            });
          }
        }
      });

      // Handle stderr
      claudeProcess.stderr.on('data', (data) => {
        this.logger.error('Claude CLI stderr:', data.toString());
        messageCallback({
          type: 'claude-error',
          error: data.toString()
        });
      });

      // Handle process completion
      claudeProcess.on('close', async (code) => {
        this.logger.log(`Claude CLI process exited with code ${code}`);

        // Clean up process reference
        const finalSessionId = capturedSessionId || sessionId || processKey;
        this.activeProcesses.delete(finalSessionId);

        messageCallback({
          type: 'claude-complete',
          exitCode: code,
          isNewSession: !sessionId && !!command
        });

        // Clean up temporary image files if any
        if (tempImagePaths && tempImagePaths.length > 0) {
          for (const imagePath of tempImagePaths) {
            await fs.unlink(imagePath).catch(err => 
              this.logger.error(`Failed to delete temp image ${imagePath}:`, err)
            );
          }
          if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => 
              this.logger.error(`Failed to delete temp directory ${tempDir}:`, err)
            );
          }
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude CLI exited with code ${code}`));
        }
      });

      // Handle process errors
      claudeProcess.on('error', (error) => {
        this.logger.error('Claude CLI process error:', error);

        // Clean up process reference on error
        const finalSessionId = capturedSessionId || sessionId || processKey;
        this.activeProcesses.delete(finalSessionId);

        messageCallback({
          type: 'claude-error',
          error: error.message
        });

        reject(error);
      });

      // Handle stdin for interactive mode
      if (command) {
        // For --print mode with arguments, we don't need to write to stdin
        claudeProcess.stdin.end();
      }
    });
  }

  abortClaudeSession(sessionId: string): boolean {
    const process = this.activeProcesses.get(sessionId);
    if (process) {
      this.logger.log(`🛑 Aborting Claude session: ${sessionId}`);
      process.kill('SIGTERM');
      this.activeProcesses.delete(sessionId);
      return true;
    }
    return false;
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.activeProcesses.keys());
  }
}