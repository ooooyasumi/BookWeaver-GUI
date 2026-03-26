import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, InputNumber, Button, Space, Divider, message, Tag } from 'antd'
import { SettingOutlined, SaveOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

interface LLMConfig {
  apiKey: string
  model: string
  baseUrl: string
  temperature: number
  maxTokens: number
}

interface DownloadConfig {
  concurrent: number
  timeout: number
}

interface Config {
  llm: LLMConfig
  download: DownloadConfig
}

const LLM_MODELS = [
  { label: 'Qwen 3.5 Plus', value: 'qwen3.5-plus' },
  { label: 'Qwen 3.5 Turbo', value: 'qwen3.5-turbo' },
  { label: 'Qwen Max', value: 'qwen-max' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
  { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
  { label: 'DeepSeek V3', value: 'deepseek-chat' },
  { label: 'DeepSeek R1', value: 'deepseek-reasoner' },
]

const DEFAULT_CONFIG: Config = {
  llm: {
    apiKey: '',
    model: 'qwen3.5-plus',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    temperature: 0.7,
    maxTokens: 2000
  },
  download: {
    concurrent: 3,
    timeout: 30
  }
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testingApi, setTestingApi] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // 加载配置
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open])

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig()
      if (config) {
        // 合并默认值，确保所有字段都有值
        form.setFieldsValue({
          llm: {
            ...DEFAULT_CONFIG.llm,
            ...config.llm
          },
          download: {
            ...DEFAULT_CONFIG.download,
            ...config.download
          }
        })
      } else {
        form.setFieldsValue(DEFAULT_CONFIG)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      // 使用默认值
      form.setFieldsValue(DEFAULT_CONFIG)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await window.electronAPI.saveConfig(values)
      message.success('配置已保存')
      onClose()
    } catch (error) {
      message.error('保存配置失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 测试 API 连接
  const handleTestApi = async () => {
    try {
      const values = await form.validateFields(['llm.apiKey', 'llm.baseUrl', 'llm.model'])
      setTestingApi(true)
      setTestStatus('idle')

      const config = {
        apiKey: values.llm.apiKey,
        baseUrl: values.llm.baseUrl,
        model: values.llm.model
      }

      const response = await fetch('/api/chat/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setTestStatus('success')
        message.success('API 连接测试成功！')
      } else {
        setTestStatus('error')
        message.error(`API 连接失败：${result.error || '未知错误'}`)
      }
    } catch (error: any) {
      setTestStatus('error')
      message.error(`API 连接失败：${error.message || '请检查 API Key 和 URL 是否正确'}`)
    } finally {
      setTestingApi(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          设置
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>
          保存
        </Button>
      ]}
    >
      <Form form={form} layout="vertical">
        <Divider orientation="left">LLM 配置</Divider>

        <Form.Item
          name={['llm', 'apiKey']}
          label="API Key"
          rules={[{ required: true, message: '请输入 API Key' }]}
          extra={
            <Space>
              <span style={{ fontSize: 12, color: '#666' }}>
                 DashScope 请使用兼容模式 URL
              </span>
              <Tag color="blue">兼容模式</Tag>
            </Space>
          }
        >
          <Input.Password placeholder="输入您的 LLM API Key" />
        </Form.Item>

        <Form.Item
          name={['llm', 'baseUrl']}
          label="API Base URL"
          rules={[{ required: true, message: '请输入 API Base URL' }]}
          extra={
            <Space wrap>
              <span style={{ fontSize: 12, color: '#999' }}>
                阿里云百炼 Coding：https://coding.dashscope.aliyuncs.com/v1
              </span>
            </Space>
          }
        >
          <Input
            placeholder="例如：https://coding.dashscope.aliyuncs.com/v1"
            addonAfter={
              <Button
                type="link"
                size="small"
                onClick={handleTestApi}
                loading={testingApi}
                disabled={!form.getFieldValue(['llm', 'apiKey'])}
              >
                测试连接
              </Button>
            }
          />
        </Form.Item>

        <Form.Item
          name={['llm', 'model']}
          label="模型"
          rules={[{ required: true, message: '请选择模型' }]}
        >
          <Select placeholder="选择 LLM 模型" options={LLM_MODELS} />
        </Form.Item>

        <Form.Item
          name={['llm', 'temperature']}
          label="Temperature"
          tooltip="控制输出的随机性，值越大越随机"
        >
          <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name={['llm', 'maxTokens']}
          label="Max Tokens"
          tooltip="控制输出的最大长度"
        >
          <InputNumber min={100} max={8000} step={100} style={{ width: '100%' }} />
        </Form.Item>

        <Divider orientation="left">下载配置</Divider>

        <Form.Item
          name={['download', 'concurrent']}
          label="并发数"
          tooltip="同时下载的书籍数量"
        >
          <InputNumber min={1} max={10} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name={['download', 'timeout']}
          label="超时时间 (秒)"
          tooltip="单个下载请求的超时时间"
        >
          <InputNumber min={10} max={120} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
