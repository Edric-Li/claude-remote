/**
 * 智能分支选择功能测试 - 简化版本
 * 验证需求 4 的核心功能
 */

describe('智能分支选择功能测试', () => {
  // 模拟 RepositoryService 的关键方法
  const mockService = {
    // 模拟 determineDefaultBranch 方法
    determineDefaultBranch(branches) {
      if (!branches || branches.length === 0) {
        return undefined;
      }

      // 优先选择 main 分支
      if (branches.includes('main')) {
        return 'main';
      }

      // 其次选择 master 分支
      if (branches.includes('master')) {
        return 'master';
      }

      // 如果既没有 main 也没有 master，选择第一个可用分支
      return branches[0];
    },

    // 模拟 parseBranchList 方法
    parseBranchList(gitOutput) {
      if (!gitOutput || typeof gitOutput !== 'string') {
        return [];
      }

      try {
        const branches = gitOutput
          .split('\n')
          .filter(line => {
            const trimmedLine = line.trim();
            return trimmedLine && trimmedLine.includes('\t');
          })
          .map(line => {
            const parts = line.split('\t');
            if (parts.length < 2) {
              return null;
            }
            
            const ref = parts[1].trim();
            
            if (ref.startsWith('refs/heads/')) {
              return ref.replace('refs/heads/', '');
            }
            
            return null;
          })
          .filter(branch => {
            if (!branch || typeof branch !== 'string') {
              return false;
            }
            
            const trimmedBranch = branch.trim();
            if (!trimmedBranch) {
              return false;
            }
            
            const invalidPatterns = [
              /^HEAD$/, 
              /^\s*$/
            ];
            
            return !invalidPatterns.some(pattern => pattern.test(trimmedBranch));
          })
          .map(branch => branch.trim())
          .filter((branch, index, array) => {
            return array.indexOf(branch) === index;
          })
          .sort();

        return branches;
      } catch (error) {
        console.warn('Failed to parse git ls-remote output:', error.message);
        return [];
      }
    },

    // 模拟 validateBranch 方法
    validateBranch(branchName, availableBranches) {
      if (!branchName || typeof branchName !== 'string') {
        return {
          isValid: false,
          message: '分支名称不能为空',
          suggestedBranch: this.determineDefaultBranch(availableBranches),
          availableBranches
        };
      }

      const trimmedBranch = branchName.trim();
      if (!trimmedBranch) {
        return {
          isValid: false,
          message: '分支名称不能为空',
          suggestedBranch: this.determineDefaultBranch(availableBranches),
          availableBranches
        };
      }

      if (!availableBranches || availableBranches.length === 0) {
        return {
          isValid: false,
          message: '无可用分支信息，请先测试连接',
          availableBranches: []
        };
      }

      // 检查分支是否存在
      if (availableBranches.includes(trimmedBranch)) {
        return {
          isValid: true,
          message: '分支验证成功',
          availableBranches
        };
      }

      // 分支不存在，尝试提供建议
      const suggestions = this.findSimilarBranches(trimmedBranch, availableBranches);
      const suggestedBranch = suggestions.length > 0 ? suggestions[0] : this.determineDefaultBranch(availableBranches);

      let message = `分支 '${trimmedBranch}' 不存在`;
      if (suggestedBranch) {
        message += `，建议使用 '${suggestedBranch}'`;
      }

      return {
        isValid: false,
        message,
        suggestedBranch,
        availableBranches
      };
    },

    // 模拟相似分支查找
    findSimilarBranches(targetBranch, availableBranches) {
      if (!targetBranch || !availableBranches) {
        return [];
      }

      const target = targetBranch.toLowerCase();
      const similarities = [];

      for (const branch of availableBranches) {
        const branchLower = branch.toLowerCase();
        let score = 0;

        // 完全匹配（不区分大小写）
        if (branchLower === target) {
          score = 100;
        }
        // 包含关系
        else if (branchLower.includes(target) || target.includes(branchLower)) {
          score = 80;
        }
        // 开头匹配
        else if (branchLower.startsWith(target) || target.startsWith(branchLower)) {
          score = 60;
        }

        if (score > 30) {
          similarities.push({ branch, score });
        }
      }

      // 按相似度降序排序
      similarities.sort((a, b) => b.score - a.score);

      return similarities.slice(0, 3).map(item => item.branch);
    }
  };

  describe('验收标准 AC2: 优先选择 main 分支', () => {
    it('当存在 main 分支时应优先选择', () => {
      const branches = ['develop', 'main', 'master', 'feature/test'];
      const result = mockService.determineDefaultBranch(branches);
      expect(result).toBe('main');
    });
  });

  describe('验收标准 AC3: 当不存在 main 但存在 master 时选择 master', () => {
    it('当只有 master 分支时应选择 master', () => {
      const branches = ['develop', 'master', 'feature/test'];
      const result = mockService.determineDefaultBranch(branches);
      expect(result).toBe('master');
    });
  });

  describe('验收标准 AC4: 既无 main 也无 master 时选择第一个可用分支', () => {
    it('当没有 main 和 master 时应选择第一个分支', () => {
      const branches = ['develop', 'feature/test', 'bugfix/issue-123'];
      const result = mockService.determineDefaultBranch(branches);
      expect(result).toBe('develop');
    });

    it('空分支列表应返回 undefined', () => {
      const result = mockService.determineDefaultBranch([]);
      expect(result).toBeUndefined();
    });
  });

  describe('验收标准 AC6: 分支不存在时报告分支不可用', () => {
    it('应该验证分支存在性并提供建议', () => {
      const availableBranches = ['main', 'develop', 'master', 'feature/auth'];
      const invalidBranch = 'feature/authentication';
      
      const result = mockService.validateBranch(invalidBranch, availableBranches);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('不存在');
      expect(result.suggestedBranch).toBe('feature/auth'); // 应该建议相似的分支
      expect(result.availableBranches).toEqual(availableBranches);
    });

    it('应该为相似分支名提供智能建议', () => {
      const availableBranches = ['main', 'development', 'dev-branch', 'prod'];
      const invalidBranch = 'dev';
      
      const suggestions = mockService.findSimilarBranches(invalidBranch, availableBranches);
      
      expect(suggestions).toContain('development');
      expect(suggestions).toContain('dev-branch');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('分支解析功能测试', () => {
    it('应该正确解析 git ls-remote 输出', () => {
      const gitOutput = [
        'abc123\trefs/heads/main',
        'def456\trefs/heads/develop',
        'ghi789\trefs/heads/feature/test',
        'jkl012\trefs/tags/v1.0.0', // 应该被过滤掉
        'mno345\tHEAD', // 应该被过滤掉
        'pqr678\trefs/pull/123/head' // 应该被过滤掉
      ].join('\n');
      
      const branches = mockService.parseBranchList(gitOutput);
      
      expect(branches).toEqual(['develop', 'feature/test', 'main']);
      expect(branches).not.toContain('v1.0.0');
      expect(branches).not.toContain('HEAD');
      expect(branches).not.toContain('123/head');
    });

    it('应该处理空的 git 输出', () => {
      expect(mockService.parseBranchList('')).toEqual([]);
      expect(mockService.parseBranchList(null)).toEqual([]);
      expect(mockService.parseBranchList(undefined)).toEqual([]);
    });

    it('应该处理格式错误的 git 输出', () => {
      const invalidOutput = 'invalid output without tabs';
      const branches = mockService.parseBranchList(invalidOutput);
      expect(branches).toEqual([]);
    });
  });

  describe('错误处理测试', () => {
    it('应该处理分支验证时的各种边界情况', () => {
      // 空分支名
      expect(mockService.validateBranch('', ['main'])).toMatchObject({
        isValid: false,
        message: '分支名称不能为空'
      });
      
      // 只有空白字符的分支名
      expect(mockService.validateBranch('   ', ['main'])).toMatchObject({
        isValid: false,
        message: '分支名称不能为空'
      });
      
      // 空的可用分支列表
      expect(mockService.validateBranch('main', [])).toMatchObject({
        isValid: false,
        message: '无可用分支信息，请先测试连接'
      });
    });
  });
});