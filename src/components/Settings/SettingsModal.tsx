import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, InputNumber, Button, Space, Divider, message } from 'antd'
import { SettingOutlined, SaveOutlined } from '@ant-design/icons'

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
]

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

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
        form.setFieldsValue(config)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
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
        >
          <Input.Password placeholder="输入您的 LLM API Key" />
        </Form.Item>

        <Form.Item
          name={['llm', 'baseUrl']}
          label="API Base URL"
          rules={[{ required: true, message: '请输入 API Base URL' }]}
        >
          <Input placeholder="例如: https://dashscope.aliyuncs.com/compatible-mode/v1" />
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